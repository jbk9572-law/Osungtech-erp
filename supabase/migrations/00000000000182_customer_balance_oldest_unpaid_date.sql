-- 미수금현황 목록(/receivables)을 KPI 타일+연체 표시가 있는 화면으로
-- 바꾸면서(사용자 승인된 디자인 방향 — "정합성/통일성 로드맵" 2단계
-- 파일럿), 거래처별 "연체일수"가 필요해졌다. get_customer_balances()는
-- 지금 total/paid/balance 합계만 주고 어느 전표부터 안 갚혔는지는 모른다
-- — lib/ar-ap.ts의 consumeOldestFirst(JS, 고객 상세 화면에서 이미 씀)와
-- 똑같은 "가장 오래된 전표부터 선입선출로 상계" 규칙을, 거래처 하나씩
-- 따로 조회하지 않고 SQL 윈도우 함수로 전체 거래처를 한 번에 계산한다.
--
-- 로직(consumeOldestFirst와 1:1 대응):
--   1) 반품(is_return)은 그 자체로 상계 풀에 합친다(JS의 totalNegative).
--   2) 실제 매출 전표(양수)만 날짜순 누적합을 구한다(JS의 pool 소진
--      순서와 동일).
--   3) 누적합이 "수금 누계 + 반품 누계"(풀)를 처음 넘어서는 전표가
--      "가장 오래된 미결제 전표"다 — 그 전표의 날짜를
--      oldest_unpaid_date로 돌려준다.
-- 거래처 전체 balance가 0 이하(미수금 없음)면 oldest_unpaid_date는
-- null이다(어차피 화면에서도 미수금 있는 거래처만 보여준다).

create or replace function public.get_customer_balances()
returns table (id uuid, name text, total numeric, paid numeric, balance numeric, oldest_unpaid_date date)
language sql
security definer
set search_path = public
as $$
  with order_totals as (
    select
      so.id,
      so.customer_id,
      so.order_date,
      so.is_return,
      sum(soi.quantity * soi.unit_price) as line_total
    from public.sales_orders so
    join public.sales_order_items soi on soi.sales_order_id = so.id
    where so.payment_method is null
    group by so.id, so.customer_id, so.order_date, so.is_return
  ),
  pos_orders as (
    select
      id,
      customer_id,
      order_date,
      sum(line_total) over (
        partition by customer_id
        order by order_date, id
        rows between unbounded preceding and current row
      ) as running_total
    from order_totals
    where not is_return
  ),
  returns_sum as (
    select customer_id, sum(line_total) as returns_total
    from order_totals
    where is_return
    group by customer_id
  ),
  pay_sum as (
    select customer_id, sum(amount) as paid
    from public.customer_payments
    group by customer_id
  ),
  pool_per_customer as (
    select
      c.id as customer_id,
      coalesce(pay.paid, 0) + coalesce(ret.returns_total, 0) as pool
    from public.customers c
    left join pay_sum pay on pay.customer_id = c.id
    left join returns_sum ret on ret.customer_id = c.id
  ),
  oldest_unpaid as (
    select distinct on (po.customer_id)
      po.customer_id,
      po.order_date
    from pos_orders po
    join pool_per_customer p on p.customer_id = po.customer_id
    where po.running_total > p.pool
    order by po.customer_id, po.order_date, po.id
  ),
  sales_total as (
    select customer_id, sum(line_total * case when is_return then -1 else 1 end) as total
    from order_totals
    group by customer_id
  )
  select
    c.id,
    c.name,
    coalesce(sales_total.total, 0) as total,
    coalesce(pay_sum.paid, 0) as paid,
    coalesce(sales_total.total, 0) - coalesce(pay_sum.paid, 0) as balance,
    oldest_unpaid.order_date as oldest_unpaid_date
  from public.customers c
  left join sales_total on sales_total.customer_id = c.id
  left join pay_sum on pay_sum.customer_id = c.id
  left join oldest_unpaid on oldest_unpaid.customer_id = c.id
  order by c.name;
$$;

grant execute on function public.get_customer_balances() to authenticated;
