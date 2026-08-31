-- 4차 정기 감사에서 확인된 3건을 고친다.
--
-- 1) create_payment_request_with_items/update_payment_request_with_items가
--    migration 58에서 파라미터 목록이 바뀌었는데(p_card_type 추가) 그 전
--    시그니처를 drop한 적이 없어, DB에는 옛 5개짜리 오버로드가 그대로 남아
--    있었다. migration 76(권한 검사)/77(auth.uid() 기반 신원 확인)은 새
--    6개짜리 시그니처만 다시 만들었을 뿐이라, 누구든 supabase-js로 옛
--    5개짜리 시그니처를 직접 호출하면 권한 검사도 신원 위조 방지도 전혀 없이
--    지급결의서를 만들 수 있었다. 옛 오버로드를 명시적으로 drop한다.
drop function if exists public.create_payment_request_with_items(
  text, date, date, uuid, jsonb
);
drop function if exists public.update_payment_request_with_items(
  uuid, text, date, date, jsonb
);

-- 2) price_change_schedules/purchase_price_change_schedules는 created_by가
--    있는데도 update/delete 정책이 여태 "로그인만 하면 전부 허용"으로 남아
--    있었다 — 본인+관리자 패턴이 빠진 사각지대. 등록/수정/취소는 본인
--    글쓴이거나 관리자만 되도록 좁힌다.
drop policy if exists "price_change_schedules_update_authenticated" on public.price_change_schedules;
create policy "price_change_schedules_update_owner_or_admin" on public.price_change_schedules
  for update using (created_by = auth.uid() or public.is_admin());
drop policy if exists "price_change_schedules_delete_authenticated" on public.price_change_schedules;
create policy "price_change_schedules_delete_owner_or_admin" on public.price_change_schedules
  for delete using (created_by = auth.uid() or public.is_admin());

drop policy if exists "purchase_price_change_schedules_update_authenticated" on public.purchase_price_change_schedules;
create policy "purchase_price_change_schedules_update_owner_or_admin" on public.purchase_price_change_schedules
  for update using (created_by = auth.uid() or public.is_admin());
drop policy if exists "purchase_price_change_schedules_delete_authenticated" on public.purchase_price_change_schedules;
create policy "purchase_price_change_schedules_delete_owner_or_admin" on public.purchase_price_change_schedules
  for delete using (created_by = auth.uid() or public.is_admin());

-- 예약이 효력일에 도달하면(화면을 여는 시점에) 그 예약을 등록한 사람이
-- 아니어도 반영돼야 하므로(누구든 거래처/공급처 화면을 열면 그때 처리),
-- 이 두 함수만 security definer로 본인 여부와 무관하게 실행되게 한다.
-- src/lib/price-schedule.ts가 이 RPC를 호출하도록 같이 바뀐다.
create or replace function public.apply_due_price_schedules(p_customer_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
begin
  insert into public.customer_product_prices (customer_id, product_id, unit_price)
  select distinct on (customer_id, product_id) customer_id, product_id, new_unit_price
  from public.price_change_schedules
  where applied_at is null
    and effective_date <= v_today
    and (p_customer_id is null or customer_id = p_customer_id)
  order by customer_id, product_id, effective_date desc
  on conflict (customer_id, product_id) do update set unit_price = excluded.unit_price;

  update public.price_change_schedules
  set applied_at = now()
  where applied_at is null
    and effective_date <= v_today
    and (p_customer_id is null or customer_id = p_customer_id);
end;
$$;

revoke all on function public.apply_due_price_schedules(uuid) from public;
grant execute on function public.apply_due_price_schedules(uuid) to authenticated;

create or replace function public.apply_due_purchase_price_schedules(p_supplier_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
begin
  insert into public.supplier_product_prices (supplier_id, product_id, unit_cost)
  select distinct on (supplier_id, product_id) supplier_id, product_id, new_unit_cost
  from public.purchase_price_change_schedules
  where applied_at is null
    and effective_date <= v_today
    and (p_supplier_id is null or supplier_id = p_supplier_id)
  order by supplier_id, product_id, effective_date desc
  on conflict (supplier_id, product_id) do update set unit_cost = excluded.unit_cost;

  update public.purchase_price_change_schedules
  set applied_at = now()
  where applied_at is null
    and effective_date <= v_today
    and (p_supplier_id is null or supplier_id = p_supplier_id);
end;
$$;

revoke all on function public.apply_due_purchase_price_schedules(uuid) from public;
grant execute on function public.apply_due_purchase_price_schedules(uuid) to authenticated;

-- 3) paper_stock_overrides는 "이 override를 누가 등록했는지"가 아니라
--    "이 override가 딸린 매출/매입 건을 누가 관리할 수 있는지"로 권한을
--    따져야 한다(canManageOrder와 동일한 기준 — src/lib/can-manage-order.ts).
--    지금까지는 로그인만 하면 아무 매출/매입 건의 수동값이든 되돌릴 수
--    있었다.
drop policy if exists "paper_stock_overrides_update_authenticated" on public.paper_stock_overrides;
create policy "paper_stock_overrides_update_order_owner_or_admin" on public.paper_stock_overrides
  for update using (
    public.is_admin()
    or exists (
      select 1 from public.sales_orders so
      where so.id = paper_stock_overrides.sales_order_id and so.created_by = auth.uid()
    )
    or exists (
      select 1 from public.purchase_orders po
      where po.id = paper_stock_overrides.purchase_order_id and po.created_by = auth.uid()
    )
  );
