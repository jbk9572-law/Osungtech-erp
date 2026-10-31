-- 미지급금현황(/payables)도 미수금현황과 같은 KPI 타일+연체 표시 화면으로
-- 통일한다(사용자 지적 — "미수금이랑 미지급금 양식을 맞춰야지"). 184번과
-- 똑같은 원리로 get_supplier_balances()에 거래처별 oldest_unpaid_date를
-- 추가한다 — consumeOldestFirst(JS, lib/ar-ap.ts getSupplierBalance가 이미
-- 씀)와 1:1 대응되는 SQL 윈도우 함수.
--
-- 매입(purchase_orders)은 매출(sales_orders)과 달리 is_return 컬럼이
-- 없다(반품 개념이 데이터에 없음) — 그래서 get_customer_balances()의
-- returns_sum/pool_per_customer 단계가 통째로 빠지고, pool은 순수
-- 지급 누계(supplier_payments)만으로 계산한다.
--
-- migration 120이 추가한 is_demo_actor()/current_tenant_id() 필터(데모
-- 계정·다른 테넌트 데이터 노출 방지)를 그대로 유지한다.

-- oldest_unpaid_date 컬럼이 늘어나 OUT 파라미터 구성이 바뀌므로
-- create or replace만으로는 안 된다(README.md "알아두면 유용한 함정들"
-- 참고) — 먼저 지운다. (이미 운영에 적용된 이 마이그레이션 자체는 영향
-- 없고, 신규 테넌트를 빈 DB부터 전체 이력 재생으로 부트스트랩할 때만
-- 걸리는 잠재 버그였다 — 로컬 전체 스키마 재생 검증 중 발견.)
drop function if exists public.get_supplier_balances();

create or replace function public.get_supplier_balances()
returns table (id uuid, name text, total numeric, paid numeric, balance numeric, oldest_unpaid_date date)
language sql
security definer
set search_path = public
as $$
  with order_totals as (
    select
      po.id,
      po.supplier_id,
      po.purchase_date,
      sum(poi.quantity * poi.unit_cost) as line_total
    from public.purchase_orders po
    join public.purchase_order_items poi on poi.purchase_order_id = po.id
    where po.payment_method is null
      and po.is_demo = public.is_demo_actor()
      and po.tenant_id = public.current_tenant_id()
    group by po.id, po.supplier_id, po.purchase_date
  ),
  running_orders as (
    select
      id,
      supplier_id,
      purchase_date,
      sum(line_total) over (
        partition by supplier_id
        order by purchase_date, id
        rows between unbounded preceding and current row
      ) as running_total
    from order_totals
  ),
  pay_sum as (
    select supplier_id, sum(amount) as paid
    from public.supplier_payments
    where is_demo = public.is_demo_actor()
      and tenant_id = public.current_tenant_id()
    group by supplier_id
  ),
  oldest_unpaid as (
    select distinct on (r.supplier_id)
      r.supplier_id,
      r.purchase_date
    from running_orders r
    left join pay_sum pay on pay.supplier_id = r.supplier_id
    where r.running_total > coalesce(pay.paid, 0)
    order by r.supplier_id, r.purchase_date, r.id
  ),
  purchase_total as (
    select supplier_id, sum(line_total) as total
    from order_totals
    group by supplier_id
  )
  select
    s.id,
    s.name,
    coalesce(purchase_total.total, 0) as total,
    coalesce(pay_sum.paid, 0) as paid,
    coalesce(purchase_total.total, 0) - coalesce(pay_sum.paid, 0) as balance,
    oldest_unpaid.purchase_date as oldest_unpaid_date
  from public.suppliers s
  left join purchase_total on purchase_total.supplier_id = s.id
  left join pay_sum on pay_sum.supplier_id = s.id
  left join oldest_unpaid on oldest_unpaid.supplier_id = s.id
  where s.is_demo = public.is_demo_actor()
    and s.tenant_id = public.current_tenant_id()
  order by s.name;
$$;

grant execute on function public.get_supplier_balances() to authenticated;
