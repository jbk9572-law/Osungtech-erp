-- "매입 등록 + 매출도 같이 등록(당일 출고)" RPC가 FIFO 재고 로트를 전혀
-- 다루지 않던 버그 수정. 206에서 purchase_order_items.remaining_quantity가
-- (default 0, not null)로 생겼는데 이 함수만 값을 안 채워서, 이 기능으로
-- 만든 매입 품목은 항상 remaining_quantity=0 < quantity가 되어
-- delete/update_purchase_with_items의 "이미 매출/로스 처리로 소진됨" 검사에
-- 영구히 걸렸다(연결된 매출을 지워도 풀리지 않음 — 사용자 보고). 또
-- 매출 줄에 fifo_consumptions가 안 남아 매출 삭제/수정 때 되돌릴 이력도
-- 없었다. 이제 매입 로트를 quantity로 채우고, 매출 줄이 방금 만든 이 매입
-- 로트에서 직접 소진하도록 기록한다(시그니처 동일 — 오버로드 안 늘어남).
-- 기존에 이 기능으로 만들어진 매입은 scripts/repair-combo-purchase-lots.sql
-- 로 별도 점검/복구한다(운영 데이터를 바꾸므로 자동 적용하지 않음).
create or replace function public.create_purchase_and_sale_with_items(
  p_supplier_id uuid,
  p_customer_id uuid,
  p_warehouse_id uuid,
  p_purchase_date date,
  p_sale_date date,
  p_purchase_memo text,
  p_sale_memo text,
  p_created_by uuid,
  p_purchase_items jsonb,
  p_sale_items jsonb,
  p_payment_method text default null,
  p_delivery_method text default null,
  p_purchase_doc_no bigint default null,
  p_sale_doc_no bigint default null,
  p_sale_delivery_method text default null,
  p_tax_type text default '과세',
  p_evidence_type text default null
)
returns table (purchase_order_id uuid, sale_order_id uuid)
language plpgsql
as $$
declare
  v_purchase_id uuid;
  v_sale_id uuid;
  v_over_product_id uuid;
  v_actor uuid := auth.uid();
  v_sale_item jsonb;
  v_sale_item_id uuid;
  v_need numeric;
  v_take numeric;
  v_lot record;
  v_cost_total numeric;
  v_cost_qty numeric;
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;

  with sale_totals as (
    select (item->>'productId')::uuid as product_id,
           sum((item->>'quantity')::numeric) as qty
    from jsonb_array_elements(p_sale_items) as item
    group by (item->>'productId')::uuid
  ),
  purchase_totals as (
    select (item->>'productId')::uuid as product_id,
           sum((item->>'quantity')::numeric) as qty
    from jsonb_array_elements(p_purchase_items) as item
    group by (item->>'productId')::uuid
  )
  select s.product_id into v_over_product_id
  from sale_totals s
  left join purchase_totals p on p.product_id = s.product_id
  where s.qty > coalesce(p.qty, 0)
  limit 1;

  if v_over_product_id is not null then
    raise exception '출고 수량이 매입 수량보다 많은 품목이 있습니다 (product_id: %)', v_over_product_id;
  end if;

  insert into public.purchase_orders
    (supplier_id, warehouse_id, purchase_date, memo, created_by, payment_method, delivery_method, doc_no, tax_type, evidence_type)
  values (
    p_supplier_id, p_warehouse_id, p_purchase_date, p_purchase_memo, v_actor, p_payment_method, p_delivery_method,
    coalesce(p_purchase_doc_no, nextval('public.purchase_orders_doc_no_seq')), p_tax_type, p_evidence_type
  )
  returning id into v_purchase_id;

  if jsonb_array_length(p_purchase_items) > 0 then
    insert into public.purchase_order_items (purchase_order_id, product_id, spec, quantity, unit_cost, remark, lot_number, remaining_quantity)
    select
      v_purchase_id,
      (item->>'productId')::uuid,
      nullif(item->>'spec', ''),
      (item->>'quantity')::numeric,
      (item->>'unitCost')::numeric,
      nullif(item->>'remark', ''),
      nullif(item->>'lotNumber', ''),
      (item->>'quantity')::numeric
    from jsonb_array_elements(p_purchase_items) as item;

    insert into public.inventory_transactions
      (product_id, warehouse_id, type, quantity, reference, purchase_order_id, created_by)
    select
      (item->>'productId')::uuid,
      p_warehouse_id,
      'in',
      (item->>'quantity')::numeric,
      'purchase_order:' || v_purchase_id,
      v_purchase_id,
      v_actor
    from jsonb_array_elements(p_purchase_items) as item;
  end if;

  insert into public.sales_orders
    (customer_id, warehouse_id, order_date, memo, created_by, payment_method, delivery_method, doc_no, tax_type, evidence_type)
  values (
    p_customer_id, p_warehouse_id, p_sale_date, p_sale_memo, v_actor, p_payment_method,
    coalesce(p_sale_delivery_method, p_delivery_method),
    coalesce(p_sale_doc_no, nextval('public.sales_orders_doc_no_seq')), p_tax_type, p_evidence_type
  )
  returning id into v_sale_id;

  if jsonb_array_length(p_sale_items) > 0 then
    -- 매출 줄마다 방금 만든 이 매입 로트에서 직접 소진한다(FIFO 이력 기록).
    -- 예전에는 매입 품목의 remaining_quantity를 채우지 않아(기본값 0) 이
    -- 기능으로 등록한 매입은 영구히 "이미 소진됨"으로 남아 매출을 지워도
    -- 매입을 삭제/수정할 수 없었고, 매출 쪽엔 소진 기록이 없어 매출을
    -- 지워도 되돌릴 게 없었다.
    for v_sale_item in select * from jsonb_array_elements(p_sale_items) loop
      insert into public.sales_order_items
        (sales_order_id, product_id, spec, quantity, unit_price, unit_cost, remark, lot_number)
      values (
        v_sale_id,
        (v_sale_item->>'productId')::uuid,
        nullif(v_sale_item->>'spec', ''),
        (v_sale_item->>'quantity')::numeric,
        (v_sale_item->>'unitPrice')::numeric,
        0,
        nullif(v_sale_item->>'remark', ''),
        nullif(v_sale_item->>'lotNumber', '')
      )
      returning id into v_sale_item_id;

      v_need := (v_sale_item->>'quantity')::numeric;
      v_cost_total := 0;
      v_cost_qty := 0;
      for v_lot in
        select poi.id, poi.remaining_quantity, poi.unit_cost
        from public.purchase_order_items poi
        where poi.purchase_order_id = v_purchase_id
          and poi.product_id = (v_sale_item->>'productId')::uuid
          and poi.remaining_quantity > 0
        order by poi.created_at asc, poi.id asc
        for update of poi
      loop
        exit when v_need <= 0;
        v_take := least(v_need, v_lot.remaining_quantity);

        update public.purchase_order_items
        set remaining_quantity = remaining_quantity - v_take
        where id = v_lot.id;

        insert into public.fifo_consumptions
          (purchase_order_item_id, consumed_quantity, consumed_unit_cost, consumed_by_type,
           sales_order_item_id, created_by)
        values (v_lot.id, v_take, v_lot.unit_cost, 'sale', v_sale_item_id, v_actor);

        v_cost_total := v_cost_total + v_take * v_lot.unit_cost;
        v_cost_qty := v_cost_qty + v_take;
        v_need := v_need - v_take;
      end loop;

      update public.sales_order_items
      set unit_cost = coalesce(
        round(v_cost_total / nullif(v_cost_qty, 0), 2),
        (select pr.cost from public.products pr where pr.id = (v_sale_item->>'productId')::uuid),
        0
      )
      where id = v_sale_item_id;
    end loop;

    insert into public.inventory_transactions
      (product_id, warehouse_id, type, quantity, reference, sales_order_id, created_by)
    select
      (item->>'productId')::uuid,
      p_warehouse_id,
      'out',
      (item->>'quantity')::numeric,
      'sales_order:' || v_sale_id,
      v_sale_id,
      v_actor
    from jsonb_array_elements(p_sale_items) as item;
  end if;

  return query select v_purchase_id, v_sale_id;
end;
$$;
