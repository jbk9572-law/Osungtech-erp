-- 드롭십 자동 연결(매입 등록 시 아직 연결 안 된 매출을 이 새 매입에 붙이는 기능)의
-- 범위를 "매입일 앞뒤 14일 이내 매출"로 제한한다. 208/209는 날짜와 무관하게 과거의
-- 모든 미연결 매출을 오래된 순으로 가져와, 새 매입이 한참 전의 엉뚱한 매출에 소진되는
-- 문제가 있었다(실제 샌드박스: 11월 16일 매입이 11월 7일 옛 매출에 연결돼 삭제 불가).
-- 14일은 드롭십이 보통 며칠 안에 끝난다는 전제의 값이며, 업무상 더 긴 경우가 있으면
-- 이 숫자만 바꾸는 마이그레이션을 추가하면 된다.
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
  v_tenant_id uuid;
  v_purchase_date date;
  v_item record;
  v_take numeric;
  v_new_total_cost numeric;
  v_new_total_qty numeric;
begin
  select poi.product_id, poi.unit_cost, poi.remaining_quantity, poi.tenant_id, po.purchase_date
    into v_product_id, v_unit_cost, v_remaining, v_tenant_id, v_purchase_date
  from public.purchase_order_items poi
  join public.purchase_orders po on po.id = poi.purchase_order_id
  where poi.id = p_purchase_order_item_id
  for update of poi;

  if v_product_id is null or v_remaining is null or v_remaining <= 0 then
    return;
  end if;

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
      -- 매입일 앞뒤 14일 이내 매출만 연결한다(드롭십은 며칠 안에 끝난다). 예전엔
      -- 과거에 재고가 모자라 연결 못 한 모든 오래된 매출이 새 매입을 가로챘다 —
      -- 그러면 그 매입이 엉뚱한 옛 매출 때문에 삭제/수정이 막히고, 옛 매출의
      -- 원가가 새 매입 단가로 바뀐다(샌드박스 실데이터에서 재현).
      and so.order_date between v_purchase_date - 14 and v_purchase_date + 14
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
      (purchase_order_item_id, consumed_quantity, consumed_unit_cost, consumed_by_type, sales_order_item_id, tenant_id)
    values
      (p_purchase_order_item_id, v_take, v_unit_cost, 'sale', v_item.sales_order_item_id, v_tenant_id);

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
