-- get_subcontractor_balances()(migration 168)가 get_customer_balances()/
-- get_supplier_balances()와 "완전히 같은 패턴"이라고 스스로 주석에
-- 적어놓고도, migration 120이 그 두 함수에 추가한
-- is_demo_actor()/current_tenant_id() 필터를 빠뜨린 채 작성됐다(헌법검사
-- 중 발견 — migration 120은 168보다 먼저 만들어졌는데 그 보안 수정이
-- 적용 안 된 채로 새 함수가 추가된 경우). 그대로 두면 데모 계정으로
-- /subcontractor-payables를 열었을 때 실제 회사의 하청업체명·가공비·
-- 지급액이 그대로 보이거나(또는 반대로), 다른 테넌트 데이터가 섞여
-- 보일 수 있다.
--
-- subcontractors/work_order_process_steps/subcontractor_payments 세
-- 테이블 모두에 is_demo/tenant_id 컬럼이 이미 있다(각 테이블의 RLS
-- 정책 — migration 168의 "_demo_isolation"/"_tenant_isolation" 정책들 —
-- 이 이미 그 컬럼들을 전제로 하고 있다). security definer 함수는 RLS를
-- 우회하므로, 함수 안에서 직접 같은 필터를 걸어야 한다.

create or replace function public.get_subcontractor_balances()
returns table (id uuid, name text, total numeric, paid numeric, balance numeric)
language sql
security definer
set search_path = public
as $$
  select
    s.id,
    s.name,
    coalesce(fees.total, 0) as total,
    coalesce(pay.paid, 0) as paid,
    coalesce(fees.total, 0) - coalesce(pay.paid, 0) as balance
  from public.subcontractors s
  left join (
    select
      wops.subcontractor_id,
      sum(coalesce(wops.unit_cost, 0) * (wo.quantity - wops.returned_quantity)) as total
    from public.work_order_process_steps wops
    join public.work_orders wo on wo.id = wops.work_order_id
    where wops.assignee_kind = 'subcontractor'
      and wops.status <> 'returned'
      and wops.is_demo = public.is_demo_actor()
      and wops.tenant_id = public.current_tenant_id()
      and wo.is_demo = public.is_demo_actor()
      and wo.tenant_id = public.current_tenant_id()
    group by wops.subcontractor_id
  ) fees on fees.subcontractor_id = s.id
  left join (
    select subcontractor_id, sum(amount) as paid
    from public.subcontractor_payments
    where is_demo = public.is_demo_actor()
      and tenant_id = public.current_tenant_id()
    group by subcontractor_id
  ) pay on pay.subcontractor_id = s.id
  where s.is_demo = public.is_demo_actor()
    and s.tenant_id = public.current_tenant_id()
  order by s.name;
$$;

grant execute on function public.get_subcontractor_balances() to authenticated;
