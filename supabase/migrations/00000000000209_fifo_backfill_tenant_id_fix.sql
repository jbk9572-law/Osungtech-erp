-- 208에서 만든 backfill_fifo_consumption_for_purchase가 fifo_consumptions에
-- insert할 때 tenant_id 컬럼을 명시하지 않고 있었다. 그 컬럼은 `default
-- public.current_tenant_id()`인데, current_tenant_id()는 auth.uid() 기준으로
-- tenant_members를 조회한다 — create_purchase_with_items를 통해 앱에서
-- 호출될 때는 인증된 세션이라 문제없이 채워지지만, 208 마이그레이션
-- 주석에 적어둔 "과거 데이터 1회성 백필" SQL을 Supabase SQL Editor에서
-- 직접 실행하면 인증 세션이 없어 auth.uid()가 null → current_tenant_id()도
-- null → "null value in column tenant_id ... violates not-null constraint"
-- 에러로 실패한다(실제로 운영 DB에서 재현 확인).
--
-- purchase_order_items 자신도 tenant_id 컬럼을 갖고 있으므로(멀티테넌시
-- 공통 마이그레이션 099에서 추가), 호출 세션의 인증 여부와 무관하게 그
-- 매입 품목줄이 속한 테넌트를 그대로 가져다 쓰도록 명시적으로 지정한다
-- — 이렇게 하면 앱에서 호출하든 SQL Editor에서 직접 실행하든 둘 다
-- 안전하게 동작한다.
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
  v_item record;
  v_take numeric;
  v_new_total_cost numeric;
  v_new_total_qty numeric;
begin
  select poi.product_id, poi.unit_cost, poi.remaining_quantity, poi.tenant_id
    into v_product_id, v_unit_cost, v_remaining, v_tenant_id
  from public.purchase_order_items poi
  where poi.id = p_purchase_order_item_id
  for update;

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

revoke all on function public.backfill_fifo_consumption_for_purchase(uuid) from public;
grant execute on function public.backfill_fifo_consumption_for_purchase(uuid) to authenticated;
