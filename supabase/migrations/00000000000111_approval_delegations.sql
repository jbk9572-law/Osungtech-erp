-- 전결권(결재 위임) — 휴가/출장 등으로 결재자가 자리를 비울 때, 지정한
-- 기간 동안 대리인이 그 사람 대신 결재를 처리할 수 있게 한다.
--
-- 무한 순환 위임을 막기 위해 체이닝을 깊이 1로 제한한다: 대리인으로
-- 지정하려는 사람이 같은 기간에 "자신의" 결재권을 이미 누군가에게
-- 위임한 상태라면(즉 그 사람도 자리를 비운 상태), 그 사람을 다시
-- 대리인으로 세울 수 없다. 위임자 쪽도 마찬가지로, 이미 같은 기간에
-- 다른 사람의 대리인으로 지정된 상태라면 자기 결재권을 또 위임할 수
-- 없다. 이 두 방향 검사만으로 A→B, B→A 순환과 A→B→C 연쇄가 모두
-- 원천 차단된다(깊이 1 초과 자체가 불가능해짐).
create table if not exists public.approval_delegations (
  id uuid primary key default gen_random_uuid(),
  delegator_id uuid not null references public.profiles (id) on delete cascade,
  delegate_id uuid not null references public.profiles (id) on delete cascade,
  start_date date not null,
  end_date date not null,
  reason text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  is_demo boolean not null default public.is_demo_actor(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  constraint approval_delegations_date_range check (end_date >= start_date),
  constraint approval_delegations_no_self check (delegator_id <> delegate_id)
);

create index if not exists approval_delegations_delegator_idx on public.approval_delegations (delegator_id);
create index if not exists approval_delegations_delegate_idx on public.approval_delegations (delegate_id);
create index if not exists approval_delegations_tenant_id_idx on public.approval_delegations (tenant_id);

create or replace function public.check_approval_delegation_chain()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1 from public.approval_delegations d
    where d.delegator_id = new.delegate_id
      and d.id <> new.id
      and d.start_date <= new.end_date and d.end_date >= new.start_date
  ) then
    raise exception '해당 대리인은 같은 기간에 자신의 결재권도 위임한 상태라 대리인으로 지정할 수 없습니다.';
  end if;

  if exists (
    select 1 from public.approval_delegations d
    where d.delegate_id = new.delegator_id
      and d.id <> new.id
      and d.start_date <= new.end_date and d.end_date >= new.start_date
  ) then
    raise exception '위임자가 같은 기간에 다른 사람의 대리 결재자로 지정되어 있어 결재권을 위임할 수 없습니다.';
  end if;

  if exists (
    select 1 from public.approval_delegations d
    where d.delegator_id = new.delegator_id
      and d.id <> new.id
      and d.start_date <= new.end_date and d.end_date >= new.start_date
  ) then
    raise exception '해당 기간에 이미 지정된 대리 결재자가 있습니다. 기존 위임을 먼저 삭제해주세요.';
  end if;

  return new;
end;
$$;

drop trigger if exists approval_delegations_check_chain on public.approval_delegations;
create trigger approval_delegations_check_chain
  before insert or update on public.approval_delegations
  for each row execute procedure public.check_approval_delegation_chain();

-- 지금 시점에 p_delegator_id의 결재권을 대신 행사할 수 있는 사람인지 —
-- decide_approval_step()과 RLS 정책 양쪽에서 재사용한다. 크로스 테이블
-- 조회를 정책 안에 직접 두면 다른 정책과 얽혀 재귀 위험이 있으니(approval
-- 관련 테이블에서 이미 한 번 겪은 문제), security definer 함수로 감싼다.
create or replace function public.is_active_delegate_for(p_delegator_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.approval_delegations d
    where d.delegator_id = p_delegator_id
      and d.delegate_id = auth.uid()
      and current_date between d.start_date and d.end_date
  );
$$;

revoke all on function public.is_active_delegate_for(uuid) from public;
grant execute on function public.is_active_delegate_for(uuid) to authenticated;

alter table public.approval_delegations enable row level security;

create policy "approval_delegations_select" on public.approval_delegations
  for select using (
    delegator_id = auth.uid() or delegate_id = auth.uid() or public.is_admin()
  );
create policy "approval_delegations_insert" on public.approval_delegations
  for insert with check (delegator_id = auth.uid() or public.is_admin());
create policy "approval_delegations_update" on public.approval_delegations
  for update using (delegator_id = auth.uid() or public.is_admin());
create policy "approval_delegations_delete" on public.approval_delegations
  for delete using (delegator_id = auth.uid() or public.is_admin());

create policy "approval_delegations_demo_isolation" on public.approval_delegations
  as restrictive for all
  using (is_demo = public.is_demo_actor()) with check (is_demo = public.is_demo_actor());
create policy "approval_delegations_tenant_isolation" on public.approval_delegations
  as restrictive for all
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

-- 결재 처리 시 대리인도 본인 차례를 처리할 수 있게 하고, 실제로 누가
-- 처리했는지(본인/대리인)를 결재 이력에 남긴다.
alter table public.approval_steps add column if not exists decided_by uuid references public.profiles (id) on delete set null;

create or replace function public.decide_approval_step(
  p_step_id uuid,
  p_decision text,
  p_comment text default null
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_doc_id uuid;
  v_doc_status text;
  v_approver_id uuid;
  v_step_order smallint;
  v_step_status text;
  v_role text;
  v_max_order smallint;
  v_earlier_unapproved integer;
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception '잘못된 처리입니다.';
  end if;

  select document_id, approver_id, step_order, status, role
    into v_doc_id, v_approver_id, v_step_order, v_step_status, v_role
  from public.approval_steps where id = p_step_id;

  if v_doc_id is null then
    raise exception '결재 단계를 찾을 수 없습니다.';
  end if;
  if v_role <> 'approver' then
    raise exception '참조자는 결재를 처리할 수 없습니다.';
  end if;

  select status into v_doc_status from public.approval_documents where id = v_doc_id;
  if v_doc_status <> 'pending' then
    raise exception '이미 종료되었거나 회수된 기안입니다.';
  end if;

  if v_approver_id <> v_actor and not public.is_admin() and not public.is_active_delegate_for(v_approver_id) then
    raise exception '본인 차례의 결재만 처리할 수 있습니다.';
  end if;
  if v_step_status <> 'pending' then
    raise exception '이미 처리된 결재입니다.';
  end if;

  select count(*) into v_earlier_unapproved
  from public.approval_steps
  where document_id = v_doc_id and role = 'approver' and step_order < v_step_order and status <> 'approved';
  if v_earlier_unapproved > 0 then
    raise exception '앞 순번 결재가 아직 끝나지 않았습니다.';
  end if;

  update public.approval_steps
  set status = p_decision, comment = p_comment, decided_at = now(), decided_by = v_actor
  where id = p_step_id;

  if p_decision = 'rejected' then
    update public.approval_documents
    set status = 'rejected', decided_at = now()
    where id = v_doc_id;
    return;
  end if;

  select max(step_order) into v_max_order
  from public.approval_steps where document_id = v_doc_id and role = 'approver';
  if v_step_order = v_max_order then
    update public.approval_documents
    set status = 'approved', decided_at = now()
    where id = v_doc_id;
  end if;
end;
$$;

-- 대리인이 자기 차례가 아닌 문서의 결재 단계를 조회할 수 있어야
-- 대결 화면이 뜬다 — 기존 approval_steps_select 정책에 대리인 조건 추가.
drop policy if exists "approval_steps_select" on public.approval_steps;
create policy "approval_steps_select" on public.approval_steps
  for select using (
    approver_id = auth.uid()
    or public.is_admin()
    or public.is_approval_document_owner(approval_steps.document_id)
    or public.is_active_delegate_for(approval_steps.approver_id)
  );
