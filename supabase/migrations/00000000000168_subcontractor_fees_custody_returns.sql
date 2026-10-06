-- 영림원식 외주관리(외주발주→외주납품→외주검사→외주입고→외주자재투입→
-- 외주비정산→외주반품)를 지금 LOT 흐름(work_order_process_steps 기반,
-- 외주처는 별도 창고가 아니라 "이 LOT의 이 공정을 맡은 업체")에 맞게
-- 들여온다. 네 가지를 더한다:
--
-- 1) 가공비 단가 — subcontractors.default_unit_cost(업체별 기본 단가) +
--    work_order_process_steps.unit_cost(공정 배정 시 개별 입력/override).
--    별도 품목별 단가표는 1차 범위에서 뺐다(나중에 필요하면 추가).
-- 2) 외주처별 보유재고 — 1차 공정이 외주로 배정된 생산지시에 한해, 자재를
--    "출고"가 아니라 외주처에게 보낸 것으로 커스터디 원장(subcontractor_
--    inventory/_transactions)에 쌓는다. 기존 inventory/inventory_
--    transactions와 완전히 같은 패턴(원장 insert -> 트리거로 잔고 upsert).
--    공정이 '완료'되면 그 LOT분 보유재고를 '투입소비'로 차감한다.
-- 3) 외주비 정산 — 전표 시스템 자체가 이 리포에 없으므로(매입채무도
--    purchase_orders+supplier_payments를 그때그때 차감 계산), 똑같은
--    컨벤션으로 subcontractor_payments만 추가하고 잔액은 저장하지 않는다.
-- 4) 반품 2종 — 외주검사반품(입고 전, 이미 있는 defect_hold를 "해결" 대신
--    "반품"으로 종료 — status='returned', 재고/정산 전혀 반영 안 함)과
--    입고 후 반품(이미 done/shipped된 단계도 나중에 수량 반품 가능 —
--    work_orders가 이미 'completed'면 재고도 마이너스 조정, 정산 금액은
--    returned_quantity만큼 자동으로 줄어듦).

-- ── 1) 가공비 단가 ──────────────────────────────────────────────

alter table public.subcontractors
  add column if not exists default_unit_cost numeric check (default_unit_cost is null or default_unit_cost >= 0);

alter table public.work_order_process_steps
  add column if not exists unit_cost numeric check (unit_cost is null or unit_cost >= 0),
  add column if not exists returned_quantity numeric not null default 0 check (returned_quantity >= 0);

-- 반품(외주검사반품)으로 종료된 단계를 표현할 상태값 추가.
alter table public.work_order_process_steps
  drop constraint if exists work_order_process_steps_status_check;
alter table public.work_order_process_steps
  add constraint work_order_process_steps_status_check
  check (status in ('pending', 'received', 'in_progress', 'done', 'shipped', 'returned'));

-- 배정 시 업체 기본단가가 있으면 자동으로 채워준다(이미 입력된 단가는
-- 덮어쓰지 않음 — 공정별로 다시 수동 수정했을 수 있으므로).
create or replace function public.assign_work_order_process_step(p_id uuid, p_subcontractor_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_default_cost numeric;
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;

  if p_subcontractor_id is null then
    update public.work_order_process_steps
    set assignee_kind = 'internal', subcontractor_id = null
    where id = p_id and tenant_id = public.current_tenant_id();
  else
    select default_unit_cost into v_default_cost
    from public.subcontractors
    where id = p_subcontractor_id and tenant_id = public.current_tenant_id();

    if not found then
      raise exception '업체를 찾을 수 없습니다.';
    end if;

    update public.work_order_process_steps
    set assignee_kind = 'subcontractor',
        subcontractor_id = p_subcontractor_id,
        unit_cost = coalesce(unit_cost, v_default_cost)
    where id = p_id and tenant_id = public.current_tenant_id();
  end if;

  if not found then
    raise exception '공정 단계를 찾을 수 없습니다.';
  end if;
end;
$$;

-- 생산지시 상세에서 공정별 단가를 그 자리에서 수정할 수 있게.
create or replace function public.set_work_order_process_step_unit_cost(p_id uuid, p_unit_cost numeric)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;
  if p_unit_cost is not null and p_unit_cost < 0 then
    raise exception '단가는 0 이상이어야 합니다.';
  end if;

  update public.work_order_process_steps
  set unit_cost = p_unit_cost
  where id = p_id and tenant_id = public.current_tenant_id();

  if not found then
    raise exception '공정 단계를 찾을 수 없습니다.';
  end if;
end;
$$;

revoke all on function public.set_work_order_process_step_unit_cost(uuid, numeric) from public;
grant execute on function public.set_work_order_process_step_unit_cost(uuid, numeric) to authenticated;

-- ── 2) 외주처별 보유재고(커스터디) ──────────────────────────────

create table if not exists public.subcontractor_inventory (
  id uuid primary key default gen_random_uuid(),
  subcontractor_id uuid not null references public.subcontractors (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  quantity numeric not null default 0 check (quantity >= 0),
  updated_at timestamptz not null default now(),
  is_demo boolean not null default public.is_demo_actor(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  unique (subcontractor_id, product_id)
);
create index if not exists subcontractor_inventory_tenant_id_idx on public.subcontractor_inventory (tenant_id);
alter table public.subcontractor_inventory enable row level security;

drop policy if exists "subcontractor_inventory_select_authenticated" on public.subcontractor_inventory;
create policy "subcontractor_inventory_select_authenticated" on public.subcontractor_inventory
  for select using (auth.role() = 'authenticated');
drop policy if exists "subcontractor_inventory_demo_isolation" on public.subcontractor_inventory;
create policy "subcontractor_inventory_demo_isolation" on public.subcontractor_inventory
  as restrictive for all
  using (is_demo = public.is_demo_actor()) with check (is_demo = public.is_demo_actor());
drop policy if exists "subcontractor_inventory_tenant_isolation" on public.subcontractor_inventory;
create policy "subcontractor_inventory_tenant_isolation" on public.subcontractor_inventory
  as restrictive for all
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

create table if not exists public.subcontractor_inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  subcontractor_id uuid not null references public.subcontractors (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  type text not null check (type in ('issued', 'consumed', 'returned', 'adjustment')),
  quantity numeric not null check (quantity <> 0),
  work_order_id uuid references public.work_orders (id) on delete set null,
  reference text,
  note text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  is_demo boolean not null default public.is_demo_actor(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id)
);
create index if not exists subcontractor_inv_tx_subcontractor_idx
  on public.subcontractor_inventory_transactions (subcontractor_id, created_at desc);
create index if not exists subcontractor_inv_tx_work_order_idx
  on public.subcontractor_inventory_transactions (work_order_id);
create index if not exists subcontractor_inv_tx_tenant_id_idx on public.subcontractor_inventory_transactions (tenant_id);
alter table public.subcontractor_inventory_transactions enable row level security;

drop policy if exists "subcontractor_inv_tx_select_authenticated" on public.subcontractor_inventory_transactions;
create policy "subcontractor_inv_tx_select_authenticated" on public.subcontractor_inventory_transactions
  for select using (auth.role() = 'authenticated');
drop policy if exists "subcontractor_inv_tx_demo_isolation" on public.subcontractor_inventory_transactions;
create policy "subcontractor_inv_tx_demo_isolation" on public.subcontractor_inventory_transactions
  as restrictive for all
  using (is_demo = public.is_demo_actor()) with check (is_demo = public.is_demo_actor());
drop policy if exists "subcontractor_inv_tx_tenant_isolation" on public.subcontractor_inventory_transactions;
create policy "subcontractor_inv_tx_tenant_isolation" on public.subcontractor_inventory_transactions
  as restrictive for all
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

-- inventory_transactions -> inventory 잔고 갱신(apply_inventory_transaction,
-- migration 1)과 완전히 같은 패턴. 'issued'/'returned'는 증가, 'consumed'는
-- 감소, 'adjustment'는 부호 그대로(수동 보정용) 반영한다.
create or replace function public.apply_subcontractor_inventory_transaction()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  delta numeric;
begin
  delta := case
    when new.type = 'consumed' then -abs(new.quantity)
    when new.type = 'adjustment' then new.quantity
    else abs(new.quantity)
  end;

  insert into public.subcontractor_inventory
    (subcontractor_id, product_id, quantity, updated_at, tenant_id, is_demo)
  values
    (new.subcontractor_id, new.product_id, delta, now(), new.tenant_id, new.is_demo)
  on conflict (subcontractor_id, product_id)
  do update set
    quantity = public.subcontractor_inventory.quantity + excluded.quantity,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_subcontractor_inventory_transaction_created on public.subcontractor_inventory_transactions;
create trigger on_subcontractor_inventory_transaction_created
  after insert on public.subcontractor_inventory_transactions
  for each row execute procedure public.apply_subcontractor_inventory_transaction();

-- 1차 공정이 외주로 배정된 생산지시에서만 쓴다 — 원재료가 우리 창고를
-- 거치지 않고 바로 업체로 나가는 경우. issue_work_order_materials()와
-- 똑같이 BOM 기준으로 우리 창고를 차감하되, 동시에 그 수량만큼 업체
-- 보유재고를 늘린다.
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

  select * into v_wo from public.work_orders where id = p_id;
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

revoke all on function public.issue_work_order_materials_to_subcontractor(uuid) from public;
grant execute on function public.issue_work_order_materials_to_subcontractor(uuid) to authenticated;

-- 1차 공정 담당 업체가 공정을 '완료'하면, 그 생산지시분 보유재고(아직
-- 소비 처리 안 된 'issued' 잔량)를 '투입소비'로 차감한다. 1차 공정이
-- 외주가 아니면(= 애초에 커스터디 자체가 없으면) 조용히 아무 일도
-- 하지 않는다.
create or replace function public.consume_subcontractor_material_for_step(p_step_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_step record;
  v_row record;
begin
  select * into v_step from public.work_order_process_steps where id = p_step_id;
  if v_step is null or v_step.assignee_kind <> 'subcontractor' or v_step.sort_order <> 1 then
    return;
  end if;

  for v_row in
    select product_id,
      sum(case when type = 'consumed' then -quantity else quantity end) as remaining
    from public.subcontractor_inventory_transactions
    where subcontractor_id = v_step.subcontractor_id and work_order_id = v_step.work_order_id
    group by product_id
    having sum(case when type = 'consumed' then -quantity else quantity end) > 0
  loop
    insert into public.subcontractor_inventory_transactions
      (subcontractor_id, product_id, type, quantity, work_order_id, reference, created_by, tenant_id, is_demo)
    values
      (v_step.subcontractor_id, v_row.product_id, 'consumed', v_row.remaining, v_step.work_order_id,
       'work_order_process_step:' || p_step_id, auth.uid(), v_step.tenant_id, v_step.is_demo);
  end loop;
end;
$$;

revoke all on function public.consume_subcontractor_material_for_step(uuid) from public;
grant execute on function public.consume_subcontractor_material_for_step(uuid) to authenticated;

-- 상태 전이 함수 둘 다(사내/업체 포털) '완료' 진입 시 커스터디 소비를
-- 같이 실행하도록 다시 정의한다. 나머지 로직은 migration 167과 동일.
create or replace function public.subcontractor_update_step_status(p_step_id uuid, p_status text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_account record;
  v_step record;
begin
  select a.id, a.subcontractor_id into v_account
  from public.customer_portal_accounts a
  where a.user_id = auth.uid() and not a.disabled and a.kind = 'subcontractor';

  if v_account is null then
    raise exception '업체 포털 계정을 확인할 수 없습니다.';
  end if;
  if p_status not in ('in_progress', 'done', 'shipped') then
    raise exception '올바르지 않은 상태 값입니다.';
  end if;

  select * into v_step
  from public.work_order_process_steps
  where id = p_step_id and assignee_kind = 'subcontractor' and subcontractor_id = v_account.subcontractor_id;

  if v_step is null then
    raise exception '배정된 공정 단계를 찾을 수 없습니다.';
  end if;
  if p_status = 'in_progress' then
    if v_step.status <> 'received' then
      raise exception '입고확인을 먼저 처리해주세요.';
    end if;
    if v_step.defect_hold then
      raise exception '입고 불량 보류 중입니다 — 원청 확인 후 진행할 수 있습니다.';
    end if;
  end if;

  update public.work_order_process_steps
  set status = p_status,
      started_at = case when p_status = 'in_progress' and started_at is null then now() else started_at end,
      completed_at = case when p_status in ('done', 'shipped') then coalesce(completed_at, now()) else completed_at end,
      shipped_at = case when p_status = 'shipped' then now() else shipped_at end
  where id = p_step_id
    and assignee_kind = 'subcontractor'
    and subcontractor_id = v_account.subcontractor_id;

  if not found then
    raise exception '배정된 공정 단계를 찾을 수 없습니다.';
  end if;

  if p_status = 'done' then
    perform public.consume_subcontractor_material_for_step(p_step_id);
  end if;
end;
$$;

revoke all on function public.subcontractor_update_step_status(uuid, text) from public;
grant execute on function public.subcontractor_update_step_status(uuid, text) to authenticated;

create or replace function public.update_work_order_process_step(p_id uuid, p_status text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_step record;
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;
  if p_status not in ('pending', 'received', 'in_progress', 'done', 'shipped') then
    raise exception '올바르지 않은 상태 값입니다.';
  end if;

  select * into v_step
  from public.work_order_process_steps
  where id = p_id and tenant_id = public.current_tenant_id();

  if v_step is null then
    raise exception '공정 단계를 찾을 수 없습니다.';
  end if;
  if p_status = 'in_progress' and v_step.defect_hold then
    raise exception '입고 불량 보류 중입니다 — 먼저 보류를 해제해주세요.';
  end if;

  update public.work_order_process_steps
  set status = p_status,
      received_at = case when p_status = 'received' and received_at is null then now() else received_at end,
      started_at = case when p_status = 'in_progress' and started_at is null then now() else started_at end,
      completed_at = case when p_status in ('done', 'shipped') then coalesce(completed_at, now()) else null end,
      shipped_at = case when p_status = 'shipped' then now() else null end
  where id = p_id and tenant_id = public.current_tenant_id();

  if not found then
    raise exception '공정 단계를 찾을 수 없습니다.';
  end if;

  if p_status = 'done' then
    perform public.consume_subcontractor_material_for_step(p_id);
  end if;
end;
$$;

-- ── 3) 외주비 정산 ──────────────────────────────────────────────

create table if not exists public.subcontractor_payments (
  id uuid primary key default gen_random_uuid(),
  subcontractor_id uuid not null references public.subcontractors (id) on delete cascade,
  paid_at date not null,
  amount numeric not null,
  method text,
  memo text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  is_demo boolean not null default public.is_demo_actor(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id)
);
create index if not exists subcontractor_payments_subcontractor_id_idx
  on public.subcontractor_payments (subcontractor_id);
create index if not exists subcontractor_payments_tenant_id_idx on public.subcontractor_payments (tenant_id);
alter table public.subcontractor_payments enable row level security;

drop policy if exists "subcontractor_payments_select_authenticated" on public.subcontractor_payments;
create policy "subcontractor_payments_select_authenticated" on public.subcontractor_payments
  for select using (auth.role() = 'authenticated');
drop policy if exists "subcontractor_payments_insert_authenticated" on public.subcontractor_payments;
create policy "subcontractor_payments_insert_authenticated" on public.subcontractor_payments
  for insert with check (auth.role() = 'authenticated');
drop policy if exists "subcontractor_payments_delete_authenticated" on public.subcontractor_payments;
create policy "subcontractor_payments_delete_authenticated" on public.subcontractor_payments
  for delete using (auth.role() = 'authenticated');
drop policy if exists "subcontractor_payments_demo_isolation" on public.subcontractor_payments;
create policy "subcontractor_payments_demo_isolation" on public.subcontractor_payments
  as restrictive for all
  using (is_demo = public.is_demo_actor()) with check (is_demo = public.is_demo_actor());
drop policy if exists "subcontractor_payments_tenant_isolation" on public.subcontractor_payments;
create policy "subcontractor_payments_tenant_isolation" on public.subcontractor_payments
  as restrictive for all
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

-- get_customer_balances()/get_supplier_balances()와 완전히 같은 패턴
-- (migration 90) — 잔액은 저장하지 않고 그때그때 집계한다. 반품(returned_
-- quantity)과 반품으로 아예 취소된 단계(status='returned')는 자동으로
-- 금액에서 빠진다.
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
    where wops.assignee_kind = 'subcontractor' and wops.status <> 'returned'
    group by wops.subcontractor_id
  ) fees on fees.subcontractor_id = s.id
  left join (
    select subcontractor_id, sum(amount) as paid
    from public.subcontractor_payments
    group by subcontractor_id
  ) pay on pay.subcontractor_id = s.id
  order by s.name;
$$;

grant execute on function public.get_subcontractor_balances() to authenticated;

-- ── 4) 반품 2종 ─────────────────────────────────────────────────

-- 외주검사반품(입고 전) — 이미 defect_hold로 보류된 단계를 "해결"(재개)
-- 대신 "반품"으로 종료한다. 재고/정산에 전혀 반영되지 않는다(애초에
-- 입고도, 투입도 안 된 상태이므로).
create or replace function public.reject_step_defect_hold(p_step_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;

  update public.work_order_step_defects
  set resolved_at = now(), resolved_by = v_actor
  where step_id = p_step_id
    and defect_type = 'receiving'
    and resolved_at is null
    and tenant_id = public.current_tenant_id();

  update public.work_order_process_steps
  set status = 'returned', defect_hold = false
  where id = p_step_id and tenant_id = public.current_tenant_id() and defect_hold;

  if not found then
    raise exception '입고 불량 보류 중인 단계를 찾을 수 없습니다.';
  end if;
end;
$$;

revoke all on function public.reject_step_defect_hold(uuid) from public;
grant execute on function public.reject_step_defect_hold(uuid) to authenticated;

-- 입고 후 반품 — 이미 완료/출고된 단계도 나중에 수량 반품이 가능하다.
-- 생산지시가 이미 'completed'(완제품이 우리 창고에 입고 완료)라면 그만큼
-- 재고를 마이너스 조정하고, 아니라면(아직 뒷공정이 진행 중이라 완제품이
-- 창고에 들어오지 않은 상태) 정산 금액만 줄인다 — 둘 다 returned_quantity
-- 누적으로 get_subcontractor_balances()에 자동 반영된다.
create or replace function public.return_work_order_process_step_quantity(
  p_step_id uuid,
  p_quantity numeric,
  p_note text default null
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_step record;
  v_wo record;
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception '반품 수량을 입력해주세요.';
  end if;

  select * into v_step
  from public.work_order_process_steps
  where id = p_step_id and tenant_id = public.current_tenant_id();
  if v_step is null then
    raise exception '공정 단계를 찾을 수 없습니다.';
  end if;
  if v_step.status not in ('done', 'shipped') then
    raise exception '완료되거나 출고된 단계만 반품 처리할 수 있습니다.';
  end if;

  select * into v_wo from public.work_orders where id = v_step.work_order_id;

  if v_step.returned_quantity + p_quantity > v_wo.quantity then
    raise exception '반품 수량이 지시 수량(%)을 초과할 수 없습니다.', v_wo.quantity;
  end if;

  insert into public.work_order_step_defects
    (step_id, defect_type, quantity, note, reported_by, reported_by_label, tenant_id, is_demo, resolved_at, resolved_by)
  values
    (p_step_id, 'work', p_quantity, p_note, v_actor, '원청(입고 후 반품)', v_step.tenant_id, v_step.is_demo, now(), v_actor);

  update public.work_order_process_steps
  set returned_quantity = returned_quantity + p_quantity
  where id = p_step_id;

  if v_wo.status = 'completed' then
    insert into public.inventory_transactions (product_id, warehouse_id, type, quantity, reference, created_by)
    values (v_wo.product_id, v_wo.warehouse_id, 'adjustment', -p_quantity, 'process_step_return:' || p_step_id, v_actor);
  end if;
end;
$$;

revoke all on function public.return_work_order_process_step_quantity(uuid, numeric, text) from public;
grant execute on function public.return_work_order_process_step_quantity(uuid, numeric, text) to authenticated;

-- 업체 포털 공정 흐름 조회에 반품 수량도 내려준다(반환 컬럼 추가 — DROP
-- 후 재정의, migration 164/167과 같은 이유).
drop function if exists public.subcontractor_get_work_order_steps(uuid);
create or replace function public.subcontractor_get_work_order_steps(p_work_order_id uuid)
returns table (
  id uuid, process_name text, sort_order int, status text,
  assignee_kind text, subcontractor_name text,
  started_at timestamptz, completed_at timestamptz, shipped_at timestamptz,
  received_at timestamptz, defect_hold boolean, defect_quantity numeric,
  returned_quantity numeric,
  is_mine boolean
)
language sql
security definer set search_path = public
stable
as $$
  select s.id, s.process_name, s.sort_order, s.status,
         s.assignee_kind, sc.name,
         s.started_at, s.completed_at, s.shipped_at,
         s.received_at, s.defect_hold, s.defect_quantity,
         s.returned_quantity,
         (s.assignee_kind = 'subcontractor' and s.subcontractor_id = a.subcontractor_id)
  from public.customer_portal_accounts a
  join public.work_order_process_steps s on s.work_order_id = p_work_order_id
  left join public.subcontractors sc on sc.id = s.subcontractor_id
  where a.user_id = auth.uid() and not a.disabled and a.kind = 'subcontractor'
    and exists (
      select 1 from public.work_order_process_steps s2
      where s2.work_order_id = p_work_order_id
        and s2.assignee_kind = 'subcontractor'
        and s2.subcontractor_id = a.subcontractor_id
    )
  order by s.sort_order;
$$;

revoke all on function public.subcontractor_get_work_order_steps(uuid) from public;
grant execute on function public.subcontractor_get_work_order_steps(uuid) to authenticated;
