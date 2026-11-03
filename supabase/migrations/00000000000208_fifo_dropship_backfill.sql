-- 드랍십(매입처에서 바로 받아 즉시 거래처로 출고) 워크플로우에서는 매출
-- 전표를 먼저 끊고 매입 전표를 나중에 입력하는 경우가 실제로 있다
-- (사용자 확인: "우린 전표를 먼저뽑아서 매입처에서 바로 매입하고 즉시
-- 납품하는경우들이 있어"). consume_fifo_layers는 매출 RPC가 실행되는
-- "그 순간" DB에 있는 매입 레이어만 본다 — 매입이 아직 입력 전이면
-- 소진할 레이어가 없어 레이어 매칭 없이 품목 기본원가(products.cost)로
-- 떨어지고, fifo_consumptions 행도 전혀 안 남는다. 나중에 매입을
-- 입력해도 아무도 다시 연결해주지 않아서:
--   1) 그 매출의 unit_cost가 실제 매입단가가 아니라 기본원가로 잘못 남고
--   2) 나중에 들어온 매입 로트의 remaining_quantity가 안 깎여서, 이미
--      나간 물건이 시스템상 "아직 재고"로 잡힌다
--   3) 대시보드 "오늘의 업무"에 "재고용 매입"/"재고분 출고"로 따로
--      표시된다(실제로는 같은 거래인데)
-- 를 유발한다. 매입을 새로 입력하는 시점에, 그 품목에 대해 아직 못
-- 채운(fifo_consumptions 합계가 quantity에 못 미치는) 매출들을 오래된
-- 주문부터 찾아 이 새 로트로 소급 연결한다.

create or replace function public.backfill_fifo_consumption_for_purchase(
  p_purchase_order_item_id uuid
)
returns void
language plpgsql
as $$
declare
  v_product_id uuid;
  v_unit_cost numeric;
  v_remaining numeric;
  v_item record;
  v_take numeric;
  v_new_total_cost numeric;
  v_new_total_qty numeric;
begin
  select poi.product_id, poi.unit_cost, poi.remaining_quantity
    into v_product_id, v_unit_cost, v_remaining
  from public.purchase_order_items poi
  where poi.id = p_purchase_order_item_id
  for update;

  if v_product_id is null or v_remaining is null or v_remaining <= 0 then
    return;
  end if;

  -- "아직 못 채운" 매출 줄 = quantity - (지금까지 이 줄을 소진한
  -- fifo_consumptions 합계). 반품(is_return)은 재고가 늘어나는 반대
  -- 방향 거래라 FIFO 소진 대상이 아니므로 뺀다. 파생 SKU로 팔린 매출도
  -- 모품목 기준으로 같이 잡아야 하므로, consume_fifo_layers 호출부
  -- (create_sale_with_items 등)와 같은 방식으로 parent_product_id를
  -- 해석해서 비교한다.
  for v_item in
    select
      soi.id as sales_order_item_id,
      soi.quantity - coalesce(
        (select sum(fc.consumed_quantity) from public.fifo_consumptions fc
         where fc.sales_order_item_id = soi.id), 0
      ) as deficit
    from public.sales_order_items soi
    join public.sales_orders so on so.id = soi.sales_order_id
    where coalesce(
      (select p.parent_product_id from public.products p where p.id = soi.product_id),
      soi.product_id
    ) = v_product_id
      and not so.is_return
    order by so.order_date asc, soi.created_at asc
    for update of soi
  loop
    exit when v_remaining <= 0;
    if v_item.deficit is null or v_item.deficit <= 0 then
      continue;
    end if;

    v_take := least(v_remaining, v_item.deficit);

    update public.purchase_order_items
    set remaining_quantity = remaining_quantity - v_take
    where id = p_purchase_order_item_id;

    insert into public.fifo_consumptions
      (purchase_order_item_id, consumed_quantity, consumed_unit_cost, consumed_by_type, sales_order_item_id)
    values
      (p_purchase_order_item_id, v_take, v_unit_cost, 'sale', v_item.sales_order_item_id);

    -- 이 매출 줄이 이미 다른 레이어에서도 일부 소진됐을 수 있으니(드문
    -- 경우), 전체 소진 이력 기준으로 unit_cost를 가중평균으로 다시
    -- 계산한다. 아직도 못 채운 나머지가 있으면 그 몫만 기본원가로 채워
    -- consume_fifo_layers의 계산 방식과 동일하게 맞춘다.
    select
      coalesce(sum(fc.consumed_quantity * fc.consumed_unit_cost), 0),
      coalesce(sum(fc.consumed_quantity), 0)
    into v_new_total_cost, v_new_total_qty
    from public.fifo_consumptions fc
    where fc.sales_order_item_id = v_item.sales_order_item_id;

    update public.sales_order_items soi2
    set unit_cost = round(
      (
        v_new_total_cost +
        greatest(soi2.quantity - v_new_total_qty, 0) *
          coalesce((select p.cost from public.products p where p.id = v_product_id), 0)
      ) / soi2.quantity,
      2
    )
    where soi2.id = v_item.sales_order_item_id;

    v_remaining := v_remaining - v_take;
  end loop;
end;
$$;

revoke all on function public.backfill_fifo_consumption_for_purchase(uuid) from public;
grant execute on function public.backfill_fifo_consumption_for_purchase(uuid) to authenticated;

-- create_purchase_with_items: 새 매입 품목줄을 넣은 직후, 그 각 줄에
-- 대해 위 백필을 한 번씩 돌린다(원래 본문은 그대로, 끝에 루프만 추가).
create or replace function public.create_purchase_with_items(
  p_supplier_id uuid,
  p_warehouse_id uuid,
  p_purchase_date date,
  p_memo text,
  p_created_by uuid,
  p_items jsonb,
  p_payment_method text default null,
  p_delivery_method text default null,
  p_doc_no bigint default null,
  p_is_carryover boolean default false,
  p_tax_type text default '과세',
  p_evidence_type text default null
)
returns uuid
language plpgsql
as $$
declare
  v_order_id uuid;
  v_actor uuid := auth.uid();
  v_poi_id uuid;
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;

  insert into public.purchase_orders
    (supplier_id, warehouse_id, purchase_date, memo, created_by, payment_method, delivery_method, doc_no, is_carryover, tax_type, evidence_type)
  values (
    p_supplier_id, p_warehouse_id, p_purchase_date, p_memo, v_actor, p_payment_method, p_delivery_method,
    coalesce(p_doc_no, nextval('public.purchase_orders_doc_no_seq')), p_is_carryover, p_tax_type, p_evidence_type
  )
  returning id into v_order_id;

  if jsonb_array_length(p_items) > 0 then
    insert into public.purchase_order_items
      (purchase_order_id, product_id, custom_name, spec, quantity, unit_cost, remark, lot_number, remaining_quantity)
    select
      v_order_id, nullif(item->>'productId', '')::uuid, nullif(item->>'customName', ''),
      nullif(item->>'spec', ''), (item->>'quantity')::numeric, (item->>'unitCost')::numeric,
      nullif(item->>'remark', ''), nullif(item->>'lotNumber', ''), (item->>'quantity')::numeric
    from jsonb_array_elements(p_items) as item;

    insert into public.inventory_transactions (product_id, warehouse_id, type, quantity, reference, purchase_order_id, created_by)
    select
      (item->>'productId')::uuid, p_warehouse_id, 'in', (item->>'quantity')::numeric,
      'purchase_order:' || v_order_id, v_order_id, v_actor
    from jsonb_array_elements(p_items) as item
    where nullif(item->>'productId', '') is not null;

    for v_poi_id in
      select id from public.purchase_order_items where purchase_order_id = v_order_id
    loop
      perform public.backfill_fifo_consumption_for_purchase(v_poi_id);
    end loop;
  end if;

  return v_order_id;
end;
$$;

-- 이미 들어와 있는 과거 매입 로트에도 같은 백필을 한 번 돌리고 싶으면
-- (예: 오늘 이전에 이미 생긴 드랍십 미매칭 건), 아래를 Supabase SQL
-- editor에서 직접 실행한다 — 이 마이그레이션 자체는 과거 데이터를
-- 건드리지 않는다(기존 매출 unit_cost를 대량으로 바꾸는 작업이라,
-- 실행 전 결과를 직접 확인하고 싶을 수 있어 자동 실행하지 않는다):
--
--   select public.backfill_fifo_consumption_for_purchase(id)
--   from public.purchase_order_items
--   where remaining_quantity > 0;
