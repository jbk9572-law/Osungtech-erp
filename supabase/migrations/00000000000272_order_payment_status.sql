-- 매출/매입 목록의 "수금/지급 상태"(완료·일부·미수)를 전표별로 계산한다.
-- 수금(지급)이 특정 전표에 직접 연결돼 있지 않으므로, 미수금 연령(get_customer_balances, 182/183)과
-- 똑같은 "오래된 전표부터 선입선출로 갚은 것으로 친다" 규칙을 쓴다 — 화면마다 숫자가 다르면 안 되기 때문이다.
--   · 결제방법이 있는 주문(현금·계좌이체 등)은 그 자리에서 결제가 끝난 것 → paid
--   · 반품(매출)은 수금 풀에 합쳐 먼저 상계한다(lib/ar-ap.ts computePartyBalance와 같은 규칙) → return
--   · 거래처가 없는 외상 주문은 갚을 곳이 없어 none
-- 120/182와 같은 보안 필터(is_demo_actor, current_tenant_id)를 반드시 유지한다 — 빠뜨리면 다른 회사 데이터가
-- security definer로 그대로 보인다. 요청한 전표의 거래처만 계산하므로(전체 거래처 X) 목록 한 화면 분량만 읽는다.

create or replace function public.get_sales_order_payment_status(p_order_ids uuid[])
returns table (order_id uuid, outstanding numeric, status text)
language sql
security definer
set search_path = public
as $$
  with req as (
    select so.id, so.customer_id, so.payment_method, so.is_return
    from public.sales_orders so
    where so.id = any(p_order_ids)
      and so.is_demo = public.is_demo_actor()
      and so.tenant_id = public.current_tenant_id()
  ),
  order_totals as (
    select so.id, so.customer_id, so.order_date, so.is_return,
           sum(soi.quantity * soi.unit_price) as line_total
    from public.sales_orders so
    join public.sales_order_items soi on soi.sales_order_id = so.id
    where so.payment_method is null
      and so.customer_id in (select customer_id from req where customer_id is not null)
      and so.is_demo = public.is_demo_actor()
      and so.tenant_id = public.current_tenant_id()
    group by so.id, so.customer_id, so.order_date, so.is_return
  ),
  pos as (
    select id, customer_id, line_total,
           sum(line_total) over (
             partition by customer_id order by order_date, id
             rows between unbounded preceding and current row
           ) as running_total
    from order_totals
    where not is_return
  ),
  ret as (
    select customer_id, sum(line_total) as returns_total
    from order_totals
    where is_return
    group by customer_id
  ),
  pay as (
    select cp.customer_id, sum(cp.amount) as paid
    from public.customer_payments cp
    where cp.customer_id in (select customer_id from req where customer_id is not null)
      and cp.is_demo = public.is_demo_actor()
      and cp.tenant_id = public.current_tenant_id()
    group by cp.customer_id
  ),
  calc as (
    select p.id, p.line_total,
           least(p.line_total,
                 greatest(0, p.running_total - (coalesce(pay.paid, 0) + coalesce(ret.returns_total, 0)))) as outstanding
    from pos p
    left join pay on pay.customer_id = p.customer_id
    left join ret on ret.customer_id = p.customer_id
  )
  select r.id as order_id,
         case when r.is_return or r.payment_method is not null or r.customer_id is null then 0
              else coalesce(c.outstanding, 0) end as outstanding,
         case when r.is_return then 'return'
              when r.payment_method is not null then 'paid'
              when r.customer_id is null then 'none'
              when coalesce(c.outstanding, 0) <= 0 then 'paid'
              when c.outstanding >= c.line_total then 'unpaid'
              else 'partial' end as status
  from req r
  left join calc c on c.id = r.id;
$$;

grant execute on function public.get_sales_order_payment_status(uuid[]) to authenticated;

create or replace function public.get_purchase_order_payment_status(p_order_ids uuid[])
returns table (order_id uuid, outstanding numeric, status text)
language sql
security definer
set search_path = public
as $$
  with req as (
    select po.id, po.supplier_id, po.payment_method
    from public.purchase_orders po
    where po.id = any(p_order_ids)
      and po.is_demo = public.is_demo_actor()
      and po.tenant_id = public.current_tenant_id()
  ),
  order_totals as (
    select po.id, po.supplier_id, po.purchase_date,
           sum(poi.quantity * poi.unit_cost) as line_total
    from public.purchase_orders po
    join public.purchase_order_items poi on poi.purchase_order_id = po.id
    where po.payment_method is null
      and po.supplier_id in (select supplier_id from req where supplier_id is not null)
      and po.is_demo = public.is_demo_actor()
      and po.tenant_id = public.current_tenant_id()
    group by po.id, po.supplier_id, po.purchase_date
  ),
  running_orders as (
    select id, supplier_id, line_total,
           sum(line_total) over (
             partition by supplier_id order by purchase_date, id
             rows between unbounded preceding and current row
           ) as running_total
    from order_totals
  ),
  pay as (
    select sp.supplier_id, sum(sp.amount) as paid
    from public.supplier_payments sp
    where sp.supplier_id in (select supplier_id from req where supplier_id is not null)
      and sp.is_demo = public.is_demo_actor()
      and sp.tenant_id = public.current_tenant_id()
    group by sp.supplier_id
  ),
  calc as (
    select r.id, r.line_total,
           least(r.line_total, greatest(0, r.running_total - coalesce(pay.paid, 0))) as outstanding
    from running_orders r
    left join pay on pay.supplier_id = r.supplier_id
  )
  select r.id as order_id,
         case when r.payment_method is not null or r.supplier_id is null then 0
              else coalesce(c.outstanding, 0) end as outstanding,
         case when r.payment_method is not null then 'paid'
              when r.supplier_id is null then 'none'
              when coalesce(c.outstanding, 0) <= 0 then 'paid'
              when c.outstanding >= c.line_total then 'unpaid'
              else 'partial' end as status
  from req r
  left join calc c on c.id = r.id;
$$;

grant execute on function public.get_purchase_order_payment_status(uuid[]) to authenticated;
