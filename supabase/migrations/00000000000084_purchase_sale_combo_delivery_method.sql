-- 버그: "매입+매출 동시등록"(create_purchase_and_sale_with_items)이
-- 매입/매출 두 전표에 같은 p_delivery_method 값을 그대로 같이 써서,
-- 화면에서 "입고방법"으로 고른 값(기본값 방문수령)이 같이 등록되는
-- 매출 전표의 납품방법에도 그대로 들어갔다. 정작 매출 단독 등록 화면의
-- 납품방법 기본값은 "직납"인데(migration 68 백필 참고), 동시등록에서는
-- 이 값을 따로 고를 방법이 없어 매번 방문수령으로 잘못 저장되고 있었다.
-- 매입 쪽 입고방법과 매출 쪽 납품방법을 위한 매개변수를 분리한다.
-- 매개변수는 기존 목록 끝에 새로 추가만 하고 기존 것은 그대로 둔다 —
-- 하나라도 순서/타입이 바뀌면 진짜 교체가 아니라 새 오버로드가 생겨버려서
-- (migration 67에서 겪은 문제) 반드시 먼저 옛 시그니처를 명시적으로 지운다.
drop function if exists public.create_purchase_and_sale_with_items(
  uuid, uuid, uuid, date, date, text, text, uuid, jsonb, jsonb, text, text, bigint, bigint
);

create or replace function public.create_purchase_and_sale_with_items(
  p_supplier_id uuid,
  p_customer_id uuid,
  p_warehouse_id uuid,
  p_purchase_date date,
  p_sale_date date,
  p_purchase_memo text,
  p_sale_memo text,
  p_created_by uuid, -- 신뢰하지 않음(migration 69 참고). 시그니처 유지 목적으로만 남김.
  p_purchase_items jsonb,
  p_sale_items jsonb,
  p_payment_method text default null,
  p_delivery_method text default null,
  p_purchase_doc_no bigint default null,
  p_sale_doc_no bigint default null,
  p_sale_delivery_method text default null
)
returns table (purchase_order_id uuid, sale_order_id uuid)
language plpgsql
as $$
declare
  v_purchase_id uuid;
  v_sale_id uuid;
  v_over_product_id uuid;
  v_actor uuid := auth.uid();
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
    (supplier_id, warehouse_id, purchase_date, memo, created_by, payment_method, delivery_method, doc_no)
  values (
    p_supplier_id, p_warehouse_id, p_purchase_date, p_purchase_memo, v_actor, p_payment_method, p_delivery_method,
    coalesce(p_purchase_doc_no, nextval('public.purchase_orders_doc_no_seq'))
  )
  returning id into v_purchase_id;

  if jsonb_array_length(p_purchase_items) > 0 then
    insert into public.purchase_order_items (purchase_order_id, product_id, spec, quantity, unit_cost, remark, lot_number)
    select
      v_purchase_id,
      (item->>'productId')::uuid,
      nullif(item->>'spec', ''),
      (item->>'quantity')::numeric,
      (item->>'unitCost')::numeric,
      nullif(item->>'remark', ''),
      nullif(item->>'lotNumber', '')
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
    (customer_id, warehouse_id, order_date, memo, created_by, payment_method, delivery_method, doc_no)
  values (
    -- 매출 쪽 납품방법은 이제 p_sale_delivery_method를 우선 쓴다 — 화면이
    -- 아직 이 값을 안 보내는 옛 호출부라면(직접 RPC 호출 등) p_delivery_method로
    -- 되돌아간다.
    p_customer_id, p_warehouse_id, p_sale_date, p_sale_memo, v_actor, p_payment_method,
    coalesce(p_sale_delivery_method, p_delivery_method),
    coalesce(p_sale_doc_no, nextval('public.sales_orders_doc_no_seq'))
  )
  returning id into v_sale_id;

  if jsonb_array_length(p_sale_items) > 0 then
    insert into public.sales_order_items (sales_order_id, product_id, spec, quantity, unit_price, remark, lot_number)
    select
      v_sale_id,
      (item->>'productId')::uuid,
      nullif(item->>'spec', ''),
      (item->>'quantity')::numeric,
      (item->>'unitPrice')::numeric,
      nullif(item->>'remark', ''),
      nullif(item->>'lotNumber', '')
    from jsonb_array_elements(p_sale_items) as item;

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
