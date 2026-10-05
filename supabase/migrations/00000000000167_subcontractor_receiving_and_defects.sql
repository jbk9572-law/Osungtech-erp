-- 업체 포털 LOT 흐름을 "시작→완료→배송" 3단계에서 "입고확인→작업시작→
-- 완료→출고" 4단계로 넓히고, 불량 신고를 추가한다. 불량은 두 종류를
-- 구분한다:
--   1) 입고시 불량 — 받은 자재/LOT 자체가 이미 불량. 이 경우는 이 공정
--      잘못이 아니므로 작업을 멈추고(defect_hold) 원청(사내)에 알려
--      확인/이전 공정과 공유된 뒤에만 작업을 재개할 수 있다.
--   2) 작업 중 불량 — 이 공정이 작업하다가 낸 불량. 이 공정 책임이므로
--      막지 않고, 수량만 차감(defect_quantity 누적)한 뒤 그대로 다음
--      단계(완료→출고)로 진행한다.
-- 단가조정은 보류(이번 범위 제외).

alter table public.work_order_process_steps
  drop constraint if exists work_order_process_steps_status_check;
alter table public.work_order_process_steps
  add constraint work_order_process_steps_status_check
  check (status in ('pending', 'received', 'in_progress', 'done', 'shipped'));

alter table public.work_order_process_steps
  add column if not exists received_at timestamptz,
  add column if not exists defect_hold boolean not null default false,
  add column if not exists defect_quantity numeric not null default 0;

create table if not exists public.work_order_step_defects (
  id uuid primary key default gen_random_uuid(),
  step_id uuid not null references public.work_order_process_steps (id) on delete cascade,
  defect_type text not null check (defect_type in ('receiving', 'work')),
  quantity numeric not null check (quantity > 0),
  note text,
  reported_by uuid not null,
  reported_by_label text not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid,
  is_demo boolean not null default public.is_demo_actor(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id)
);
create index if not exists work_order_step_defects_step_id_idx on public.work_order_step_defects (step_id);
create index if not exists work_order_step_defects_tenant_id_idx on public.work_order_step_defects (tenant_id);
alter table public.work_order_step_defects enable row level security;

-- 사내 직원(authenticated)은 자기 테넌트 것만 조회/수정 가능(불량 보류
-- 해제는 사내에서만 처리). 업체 포털 세션은 테넌트 소속이 없어 이 정책
-- 으로는 아예 못 건드리고, 아래 SECURITY DEFINER 함수로만 접근한다.
drop policy if exists "work_order_step_defects_select_authenticated" on public.work_order_step_defects;
create policy "work_order_step_defects_select_authenticated" on public.work_order_step_defects
  for select using (auth.role() = 'authenticated');
drop policy if exists "work_order_step_defects_update_authenticated" on public.work_order_step_defects;
create policy "work_order_step_defects_update_authenticated" on public.work_order_step_defects
  for update using (auth.role() = 'authenticated');

drop policy if exists "work_order_step_defects_demo_isolation" on public.work_order_step_defects;
create policy "work_order_step_defects_demo_isolation" on public.work_order_step_defects
  as restrictive for all
  using (is_demo = public.is_demo_actor()) with check (is_demo = public.is_demo_actor());
drop policy if exists "work_order_step_defects_tenant_isolation" on public.work_order_step_defects;
create policy "work_order_step_defects_tenant_isolation" on public.work_order_step_defects
  as restrictive for all
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

-- 업체 포털: 입고확인(정상/불량 둘 다 이 함수 하나로 처리) — 정상이면
-- received로, 불량이면 보류 상태로 멈추고 사내에 알린다.
-- 알림 발송(web-push 포함)은 TypeScript 쪽(notifyForTenant)에서만 할 수
-- 있어(SQL 함수에서 HTTP 호출 불가) 이 함수는 DB 기록(불량 보고+보류
-- 설정)까지만 하고, 반환값으로 알림에 필요한 정보(tenant_id/is_demo/
-- work_order_id/공정명/업체명)를 돌려준다 — 호출한 서버 액션이 그 값으로
-- notifyForTenant()를 이어서 호출한다.
create or replace function public.subcontractor_confirm_receiving(
  p_step_id uuid,
  p_has_defect boolean,
  p_defect_quantity numeric default null,
  p_note text default null
)
returns table (tenant_id uuid, is_demo boolean, work_order_id uuid, process_name text, subcontractor_name text)
language plpgsql
security definer set search_path = public
as $$
declare
  v_account record;
  v_step record;
begin
  select a.id, a.subcontractor_id, a.tenant_id, sc.name into v_account
  from public.customer_portal_accounts a
  join public.subcontractors sc on sc.id = a.subcontractor_id
  where a.user_id = auth.uid() and not a.disabled and a.kind = 'subcontractor';

  if v_account is null then
    raise exception '업체 포털 계정을 확인할 수 없습니다.';
  end if;

  select * into v_step
  from public.work_order_process_steps
  where id = p_step_id and assignee_kind = 'subcontractor' and subcontractor_id = v_account.subcontractor_id;

  if v_step is null then
    raise exception '배정된 공정 단계를 찾을 수 없습니다.';
  end if;
  if v_step.status <> 'pending' then
    raise exception '이미 입고확인 처리된 단계입니다.';
  end if;

  if p_has_defect then
    if p_defect_quantity is null or p_defect_quantity <= 0 then
      raise exception '불량 수량을 입력해주세요.';
    end if;

    insert into public.work_order_step_defects
      (step_id, defect_type, quantity, note, reported_by, reported_by_label, tenant_id, is_demo)
    values
      (p_step_id, 'receiving', p_defect_quantity, p_note, auth.uid(), v_account.name, v_step.tenant_id, v_step.is_demo);

    update public.work_order_process_steps
    set defect_hold = true
    where id = p_step_id;

    -- 알림은 호출한 서버 액션이 이 반환값으로 notifyForTenant()를 호출해
    -- 보낸다(SQL에서는 web-push HTTP 호출을 할 수 없음).
    return query select v_step.tenant_id, v_step.is_demo, v_step.work_order_id, v_step.process_name, v_account.name;
  else
    update public.work_order_process_steps
    set status = 'received', received_at = now()
    where id = p_step_id;
  end if;
end;
$$;

revoke all on function public.subcontractor_confirm_receiving(uuid, boolean, numeric, text) from public;
grant execute on function public.subcontractor_confirm_receiving(uuid, boolean, numeric, text) to authenticated;

-- 업체 포털: 작업 중 불량 — 막지 않고 수량만 차감, 이 공정 책임으로 기록.
create or replace function public.subcontractor_report_work_defect(
  p_step_id uuid,
  p_quantity numeric,
  p_note text default null
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_account record;
  v_step record;
begin
  select a.id, a.subcontractor_id, sc.name into v_account
  from public.customer_portal_accounts a
  join public.subcontractors sc on sc.id = a.subcontractor_id
  where a.user_id = auth.uid() and not a.disabled and a.kind = 'subcontractor';

  if v_account is null then
    raise exception '업체 포털 계정을 확인할 수 없습니다.';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception '불량 수량을 입력해주세요.';
  end if;

  select * into v_step
  from public.work_order_process_steps
  where id = p_step_id and assignee_kind = 'subcontractor' and subcontractor_id = v_account.subcontractor_id;

  if v_step is null then
    raise exception '배정된 공정 단계를 찾을 수 없습니다.';
  end if;
  if v_step.status <> 'in_progress' then
    raise exception '작업 중인 단계에서만 불량을 신고할 수 있습니다.';
  end if;

  insert into public.work_order_step_defects
    (step_id, defect_type, quantity, note, reported_by, reported_by_label, tenant_id, is_demo)
  values
    (p_step_id, 'work', p_quantity, p_note, auth.uid(), v_account.name, v_step.tenant_id, v_step.is_demo);

  update public.work_order_process_steps
  set defect_quantity = defect_quantity + p_quantity
  where id = p_step_id;
end;
$$;

revoke all on function public.subcontractor_report_work_defect(uuid, numeric, text) from public;
grant execute on function public.subcontractor_report_work_defect(uuid, numeric, text) to authenticated;

-- 업체 포털: 상태 전이(받음→시작/완료/배송) — 'received' 상태를 추가로
-- 허용하고, 입고 불량 보류 중이면 시작을 막는다.
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
end;
$$;

revoke all on function public.subcontractor_update_step_status(uuid, text) from public;
grant execute on function public.subcontractor_update_step_status(uuid, text) to authenticated;

-- 사내: 입고 불량 보류 해제(이전 공정/업체와 공유·확인 후 처리).
create or replace function public.resolve_step_defect_hold(p_step_id uuid)
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
  set defect_hold = false
  where id = p_step_id and tenant_id = public.current_tenant_id();

  if not found then
    raise exception '공정 단계를 찾을 수 없습니다.';
  end if;
end;
$$;

revoke all on function public.resolve_step_defect_hold(uuid) from public;
grant execute on function public.resolve_step_defect_hold(uuid) to authenticated;

-- 사내용 상태 변경 함수도 같은 모델을 쓴다 — 'received'를 추가로 허용
-- 하고, 업체 포털용 함수와 똑같이 입고 불량 보류 중이면 시작을 막는다
-- (생산지시 상세에서 사내 직원이 업체 배정 공정 줄을 직접 클릭해
-- 보류를 우회할 수 없게).
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
end;
$$;

-- 업체 포털: 전체 공정 흐름 조회에 입고확인/불량 정보를 추가로 내려준다
-- (반환 컬럼이 늘어나 DROP 후 재정의 — migration 164와 같은 이유).
drop function if exists public.subcontractor_get_work_order_steps(uuid);
create or replace function public.subcontractor_get_work_order_steps(p_work_order_id uuid)
returns table (
  id uuid, process_name text, sort_order int, status text,
  assignee_kind text, subcontractor_name text,
  started_at timestamptz, completed_at timestamptz, shipped_at timestamptz,
  received_at timestamptz, defect_hold boolean, defect_quantity numeric,
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
