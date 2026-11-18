-- 265: 정책 반영 — (1) 마감일 이전 날짜로 거래를 새로 등록/변경하는 것은 관리자만, (2) 재고가 부족하면 자재투입 불가(음수 재고 금지),
--      (3) 월 메일·세금계산서 쿼터 조회(차단은 앱 코드가 이 값을 보고 한다).

-- 1) 마감일. 수정·삭제는 이미 막혀 있었고(207), 새로 등록하거나 날짜를 마감 이전으로 바꾸는 길이 열려 있었다.
--    함수 몇 개가 아니라 테이블 트리거로 막아 RPC·REST·복합등록 어느 경로든 같은 규칙을 탄다.
create or replace function public.guard_order_before_closing()
returns trigger
language plpgsql
as $$
declare
  v_closing date;
  v_new date;
  v_old date;
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if public.is_admin() or public.is_sandbox_tenant() then
    return new;
  end if;
  if tg_table_name = 'sales_orders' then
    v_new := (to_jsonb(new) ->> 'order_date')::date;
    if tg_op = 'UPDATE' then v_old := (to_jsonb(old) ->> 'order_date')::date; end if;
  else
    v_new := (to_jsonb(new) ->> 'purchase_date')::date;
    if tg_op = 'UPDATE' then v_old := (to_jsonb(old) ->> 'purchase_date')::date; end if;
  end if;
  if tg_op = 'UPDATE' and v_new is not distinct from v_old then
    return new;
  end if;
  select closing_date into v_closing from public.tenants where id = public.current_tenant_id();
  if v_closing is not null and v_new is not null and v_new <= v_closing then
    raise exception '마감일(%) 이전 날짜로는 관리자만 거래를 등록·변경할 수 있습니다.', to_char(v_closing, 'YYYY-MM-DD');
  end if;
  return new;
end;
$$;

drop trigger if exists sales_orders_guard_closing on public.sales_orders;
create trigger sales_orders_guard_closing
  before insert or update on public.sales_orders
  for each row execute function public.guard_order_before_closing();
drop trigger if exists purchase_orders_guard_closing on public.purchase_orders;
create trigger purchase_orders_guard_closing
  before insert or update on public.purchase_orders
  for each row execute function public.guard_order_before_closing();

-- 2) 자재투입 전 재고 확인(구성품별 합산, 행 잠금으로 동시 투입 방지). 부족하면 어떤 품목이 얼마나 모자란지 알려 준다.
create or replace function public.assert_work_order_materials_available(p_product_id uuid, p_warehouse_id uuid, p_quantity numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  perform 1
  from public.inventory i
  where i.warehouse_id = p_warehouse_id
    and i.product_id in (select b.component_product_id from public.bom_items b where b.parent_product_id = p_product_id)
  for update;

  select p.name, n.need, coalesce(i.quantity, 0) as have
    into r
  from (
    select b.component_product_id, sum(b.quantity_per_unit * p_quantity) as need
    from public.bom_items b
    where b.parent_product_id = p_product_id
    group by b.component_product_id
  ) n
  join public.products p on p.id = n.component_product_id
  left join public.inventory i on i.product_id = n.component_product_id and i.warehouse_id = p_warehouse_id
  where n.need > coalesce(i.quantity, 0)
  order by p.name
  limit 1;

  if found then
    raise exception '"%" 재고가 부족해 자재를 투입할 수 없습니다. (필요 %, 현재 %)', r.name, r.need, r.have;
  end if;
end;
$$;
revoke all on function public.assert_work_order_materials_available(uuid, uuid, numeric) from public, anon, authenticated;

create or replace function public.issue_work_order_materials(p_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_status text;
  v_product_id uuid;
  v_warehouse_id uuid;
  v_quantity numeric;
  v_tenant_id uuid;
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;

  select status, product_id, warehouse_id, quantity, tenant_id
    into v_status, v_product_id, v_warehouse_id, v_quantity, v_tenant_id
  from public.work_orders where id = p_id
  for update;

  if v_status is null then
    raise exception '생산지시를 찾을 수 없습니다.';
  end if;
  if v_tenant_id <> public.current_tenant_id() then
    raise exception '다른 회사의 생산지시는 처리할 수 없습니다.';
  end if;
  if v_status <> 'pending' then
    raise exception '대기 상태인 생산지시만 자재투입할 수 있습니다(현재: %).', v_status;
  end if;

  perform public.assert_work_order_materials_available(v_product_id, v_warehouse_id, v_quantity);

  insert into public.inventory_transactions (product_id, warehouse_id, type, quantity, reference, created_by)
  select component_product_id, v_warehouse_id, 'out', quantity_per_unit * v_quantity,
         'work_order:' || p_id, v_actor
  from public.bom_items
  where parent_product_id = v_product_id;

  update public.work_orders
  set status = 'material_issued', material_issued_at = now()
  where id = p_id;
end;
$$;

create or replace function public.issue_work_order_materials_to_subcontractor(p_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_wo record;
  v_first_step record;
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;

  select * into v_wo from public.work_orders where id = p_id for update;
  if v_wo is null then
    raise exception '생산지시를 찾을 수 없습니다.';
  end if;
  if v_wo.tenant_id <> public.current_tenant_id() then
    raise exception '다른 회사의 생산지시는 처리할 수 없습니다.';
  end if;
  if v_wo.status <> 'pending' then
    raise exception '대기 상태인 생산지시만 자재투입할 수 있습니다(현재: %).', v_wo.status;
  end if;

  select * into v_first_step
  from public.work_order_process_steps
  where work_order_id = p_id
  order by sort_order
  limit 1;

  if v_first_step is null or v_first_step.assignee_kind <> 'subcontractor' then
    raise exception '첫 공정이 외주로 배정된 생산지시에서만 사용할 수 있습니다.';
  end if;

  perform public.assert_work_order_materials_available(v_wo.product_id, v_wo.warehouse_id, v_wo.quantity);

  insert into public.inventory_transactions (product_id, warehouse_id, type, quantity, reference, created_by)
  select component_product_id, v_wo.warehouse_id, 'out', quantity_per_unit * v_wo.quantity,
         'work_order:' || p_id, v_actor
  from public.bom_items
  where parent_product_id = v_wo.product_id;

  insert into public.subcontractor_inventory_transactions
    (subcontractor_id, product_id, type, quantity, work_order_id, reference, created_by, tenant_id, is_demo)
  select v_first_step.subcontractor_id, component_product_id, 'issued', quantity_per_unit * v_wo.quantity,
         p_id, 'work_order:' || p_id, v_actor, v_wo.tenant_id, v_wo.is_demo
  from public.bom_items
  where parent_product_id = v_wo.product_id;

  update public.work_orders
  set status = 'material_issued', material_issued_at = now()
  where id = p_id;
end;
$$;

revoke all on function public.issue_work_order_materials(uuid) from public;
grant execute on function public.issue_work_order_materials(uuid) to authenticated;
revoke all on function public.issue_work_order_materials_to_subcontractor(uuid) from public;
grant execute on function public.issue_work_order_materials_to_subcontractor(uuid) to authenticated;

-- 3) 이번 달 메일·세금계산서 사용량과 한도. 플랫폼 운영 회사·샌드박스·데모 계정은 한도 없음(exempt).
create or replace function public.get_monthly_quota_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.current_tenant_id();
  v_ym text := to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM');
  t record;
  u record;
begin
  if auth.uid() is null or v_tenant is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;
  select monthly_email_quota, monthly_tax_invoice_quota, coalesce(is_platform_operator, false) as op, coalesce(is_sandbox, false) as sb
    into t from public.tenants where id = v_tenant;
  select coalesce(email_sent_count, 0) as e, coalesce(invoice_issued_count, 0) as i
    into u from public.tenant_monthly_usage where tenant_id = v_tenant and year_month = v_ym;
  return jsonb_build_object(
    'exempt', t.op or t.sb or public.is_demo_actor(),
    'email_used', coalesce(u.e, 0),
    'email_quota', t.monthly_email_quota,
    'invoice_used', coalesce(u.i, 0),
    'invoice_quota', t.monthly_tax_invoice_quota
  );
end;
$$;
revoke all on function public.get_monthly_quota_status() from public;
grant execute on function public.get_monthly_quota_status() to authenticated;
