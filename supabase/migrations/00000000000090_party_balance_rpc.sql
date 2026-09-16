-- 미수금현황/미지급금현황(/receivables, /payables) 목록이 거래처별 잔액을
-- 앱 서버로 sales_order_items/purchase_order_items 전체를 통째로 내려받아
-- JS에서 합산하고 있었다 — 거래가 쌓일수록 그대로 느려지는, 이 코드베이스
-- 안에서 유일하게 진짜 "무제한" 쿼리였다. 같은 계산(외상 주문만, 반품은
-- 마이너스로, 거래처별 합계)을 SQL 집계로 DB 안에서 끝내고 합계 행만
-- 받아오도록 RPC로 옮긴다. get_database_size()와 같은 패턴(security
-- definer + authenticated에게만 grant) — 이 테이블들의 RLS 정책이 이미
-- "로그인만 하면 전체 열람 가능"이라 definer로 우회해도 결과가 동일하다.

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
    group by so.customer_id
  ) sales on sales.customer_id = c.id
  left join (
    select customer_id, sum(amount) as paid
    from public.customer_payments
    group by customer_id
  ) pay on pay.customer_id = c.id
  order by c.name;
$$;

grant execute on function public.get_customer_balances() to authenticated;

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
    group by po.supplier_id
  ) purchases on purchases.supplier_id = s.id
  left join (
    select supplier_id, sum(amount) as paid
    from public.supplier_payments
    group by supplier_id
  ) pay on pay.supplier_id = s.id
  order by s.name;
$$;

grant execute on function public.get_supplier_balances() to authenticated;
