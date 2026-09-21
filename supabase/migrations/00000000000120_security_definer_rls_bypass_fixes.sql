-- security definer 함수는 RLS를 통째로 우회한다(호출자 권한이 아니라
-- 함수 소유자 권한으로 실행되기 때문). migration 85(데모 격리)와
-- migration 99(멀티테넌트 격리)가 나중에 RESTRICTIVE 정책(is_demo/
-- tenant_id 필터)을 얹었을 때, 그 이전에 만들어진 security definer
-- 함수 중 두 군데가 새로 생긴 필터를 안에서 다시 걸어주지 않아서 그대로
-- 뚫려 있었다. 같은 문제(정의 시점엔 안전했지만 이후 격리 정책이 얹히며
-- 깨진 security definer 함수)를 코드베이스 전체에서 찾아 한 번에 고친다.
--
-- 1) get_customer_balances()/get_supplier_balances() (migration 90) —
--    "미수금현황"/"미지급금현황" 화면이 쓴다. 데모 계정으로 열면 실제
--    회사 거래처/매출/입금이 데모 데이터와 합산되어 그대로 보이는 사고.
-- 2) apply_due_price_schedules()/apply_due_purchase_price_schedules()
--    (migration 79) — 매출/매입 등록 화면을 "열기만" 해도 호출되는데,
--    거래처/공급처 id를 안 넘기는 호출(sales/purchases 신규 등록
--    페이지)에서는 필터가 전혀 없어 테넌트/데모 구분 없이 전체
--    price_change_schedules를 반영해버린다 — 데모 계정이 새 매출 등록
--    화면만 열어도 실제 회사 거래처의 예약 단가가 조기 반영되고, 그
--    결과 행(customer_product_prices)은 실제 거래처 id에 데모 tenant_id/
--    is_demo가 섞여 들어가는 데이터 오염까지 발생할 수 있었다.

create or replace function public.get_customer_balances()
returns table (id uuid, name text, total numeric, paid numeric, balance numeric)
language sql
security definer
set search_path = public
as $$
  select
    c.id,
    c.name,
    coalesce(sales.total, 0) as total,
    coalesce(pay.paid, 0) as paid,
    coalesce(sales.total, 0) - coalesce(pay.paid, 0) as balance
  from public.customers c
  left join (
    select
      so.customer_id,
      sum(soi.quantity * soi.unit_price * case when so.is_return then -1 else 1 end) as total
    from public.sales_orders so
    join public.sales_order_items soi on soi.sales_order_id = so.id
    where so.payment_method is null
      and so.is_demo = public.is_demo_actor()
      and so.tenant_id = public.current_tenant_id()
    group by so.customer_id
  ) sales on sales.customer_id = c.id
  left join (
    select customer_id, sum(amount) as paid
    from public.customer_payments
    where is_demo = public.is_demo_actor()
      and tenant_id = public.current_tenant_id()
    group by customer_id
  ) pay on pay.customer_id = c.id
  where c.is_demo = public.is_demo_actor()
    and c.tenant_id = public.current_tenant_id()
  order by c.name;
$$;

create or replace function public.get_supplier_balances()
returns table (id uuid, name text, total numeric, paid numeric, balance numeric)
language sql
security definer
set search_path = public
as $$
  select
    s.id,
    s.name,
    coalesce(purchases.total, 0) as total,
    coalesce(pay.paid, 0) as paid,
    coalesce(purchases.total, 0) - coalesce(pay.paid, 0) as balance
  from public.suppliers s
  left join (
    select
      po.supplier_id,
      sum(poi.quantity * poi.unit_cost) as total
    from public.purchase_orders po
    join public.purchase_order_items poi on poi.purchase_order_id = po.id
    where po.payment_method is null
      and po.is_demo = public.is_demo_actor()
      and po.tenant_id = public.current_tenant_id()
    group by po.supplier_id
  ) purchases on purchases.supplier_id = s.id
  left join (
    select supplier_id, sum(amount) as paid
    from public.supplier_payments
    where is_demo = public.is_demo_actor()
      and tenant_id = public.current_tenant_id()
    group by supplier_id
  ) pay on pay.supplier_id = s.id
  where s.is_demo = public.is_demo_actor()
    and s.tenant_id = public.current_tenant_id()
  order by s.name;
$$;

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
    and is_demo = public.is_demo_actor()
    and tenant_id = public.current_tenant_id()
  order by customer_id, product_id, effective_date desc
  on conflict (customer_id, product_id) do update set unit_price = excluded.unit_price;

  update public.price_change_schedules
  set applied_at = now()
  where applied_at is null
    and effective_date <= v_today
    and (p_customer_id is null or customer_id = p_customer_id)
    and is_demo = public.is_demo_actor()
    and tenant_id = public.current_tenant_id();
end;
$$;

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
    and is_demo = public.is_demo_actor()
    and tenant_id = public.current_tenant_id()
  order by supplier_id, product_id, effective_date desc
  on conflict (supplier_id, product_id) do update set unit_cost = excluded.unit_cost;

  update public.purchase_price_change_schedules
  set applied_at = now()
  where applied_at is null
    and effective_date <= v_today
    and (p_supplier_id is null or supplier_id = p_supplier_id)
    and is_demo = public.is_demo_actor()
    and tenant_id = public.current_tenant_id();
end;
$$;
