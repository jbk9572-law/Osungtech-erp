-- 285: 미수금·미지급금을 부가세 포함 금액으로 계산한다(표준 방식).
-- 지금까지는 공급가액만 합쳐서, 부가세를 포함해 받은 입금이 "초과 입금"으로 잡히고 실제로 받을 돈보다 미수금이 작게 보였다.
-- 전표 하나의 금액 = 품목 합계(공급가액) + (과세 전표만) 공급가액의 10%(원 단위 반올림). 세액은 lib/tax.ts calcVat과 같은 규칙이다.
-- 면세·영세 전표와 결제방법이 있는 전표(미수금에서 제외)는 기존과 같다. 보안 필터(is_demo_actor, current_tenant_id)는 원본 정의를 그대로 유지했다.
-- 대상: get_customer_balances / get_supplier_balances / get_sales_order_payment_status / get_purchase_order_payment_status.

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
      (sum(soi.quantity * soi.unit_price) + case when so.tax_type = '과세' then round(sum(soi.quantity * soi.unit_price) * 0.1) else 0 end) as line_total
    from public.sales_orders so
    join public.sales_order_items soi on soi.sales_order_id = so.id
    where so.payment_method is null
      and so.is_demo = public.is_demo_actor()
      and so.tenant_id = public.current_tenant_id()
    group by so.id, so.customer_id, so.order_date, so.is_return, so.tax_type
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
    where is_demo = public.is_demo_actor()
      and tenant_id = public.current_tenant_id()
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
  where c.is_demo = public.is_demo_actor()
    and c.tenant_id = public.current_tenant_id()
  order by c.name;
$$;

grant execute on function public.get_customer_balances() to authenticated;

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
      (sum(poi.quantity * poi.unit_cost) + case when po.tax_type = '과세' then round(sum(poi.quantity * poi.unit_cost) * 0.1) else 0 end) as line_total
    from public.purchase_orders po
    join public.purchase_order_items poi on poi.purchase_order_id = po.id
    where po.payment_method is null
      and po.is_demo = public.is_demo_actor()
      and po.tenant_id = public.current_tenant_id()
    group by po.id, po.supplier_id, po.purchase_date, po.tax_type
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
           (sum(soi.quantity * soi.unit_price) + case when so.tax_type = '과세' then round(sum(soi.quantity * soi.unit_price) * 0.1) else 0 end) as line_total
    from public.sales_orders so
    join public.sales_order_items soi on soi.sales_order_id = so.id
    where so.payment_method is null
      and so.customer_id in (select customer_id from req where customer_id is not null)
      and so.is_demo = public.is_demo_actor()
      and so.tenant_id = public.current_tenant_id()
    group by so.id, so.customer_id, so.order_date, so.is_return, so.tax_type
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
           (sum(poi.quantity * poi.unit_cost) + case when po.tax_type = '과세' then round(sum(poi.quantity * poi.unit_cost) * 0.1) else 0 end) as line_total
    from public.purchase_orders po
    join public.purchase_order_items poi on poi.purchase_order_id = po.id
    where po.payment_method is null
      and po.supplier_id in (select supplier_id from req where supplier_id is not null)
      and po.is_demo = public.is_demo_actor()
      and po.tenant_id = public.current_tenant_id()
    group by po.id, po.supplier_id, po.purchase_date, po.tax_type
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
