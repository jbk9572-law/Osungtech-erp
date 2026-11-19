-- 거래처/공급처 목록의 "최근 거래일" — 요청한 거래처(공급처)들의 마지막 매출(매입) 일자만 한 번에 돌려준다.
-- 목록 한 화면 분량(p_*_ids)만 읽으므로 전체 이력을 훑지 않는다. 120/182와 같은 보안 필터(is_demo_actor,
-- current_tenant_id)를 유지한다 — 빠뜨리면 다른 회사 데이터가 security definer로 그대로 보인다.
create or replace function public.get_customer_last_order_dates(p_customer_ids uuid[])
returns table (customer_id uuid, last_order_date date)
language sql
security definer
set search_path = public
as $$
  select so.customer_id, max(so.order_date) as last_order_date
  from public.sales_orders so
  where so.customer_id = any(p_customer_ids)
    and so.is_demo = public.is_demo_actor()
    and so.tenant_id = public.current_tenant_id()
  group by so.customer_id;
$$;

grant execute on function public.get_customer_last_order_dates(uuid[]) to authenticated;

create or replace function public.get_supplier_last_order_dates(p_supplier_ids uuid[])
returns table (supplier_id uuid, last_order_date date)
language sql
security definer
set search_path = public
as $$
  select po.supplier_id, max(po.purchase_date) as last_order_date
  from public.purchase_orders po
  where po.supplier_id = any(p_supplier_ids)
    and po.is_demo = public.is_demo_actor()
    and po.tenant_id = public.current_tenant_id()
  group by po.supplier_id;
$$;

grant execute on function public.get_supplier_last_order_dates(uuid[]) to authenticated;
