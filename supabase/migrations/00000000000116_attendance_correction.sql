-- 근태 정정 신청 — 출퇴근 체크를 깜빡했거나 시간이 잘못 찍혔을 때, 본인이
-- 직접 attendance_records를 고치지 못하게(부정 출퇴근 조작 방지) 하고
-- 대신 결재선을 거쳐 승인되면 그때 실제 기록이 반영되게 한다. 연차
-- 신청(마이그레이션 115)과 같은 구조 — submit_*로 신청+결재선을 원자적
-- 생성, 트리거로 결재 결과를 반영한다.
create table if not exists public.attendance_correction_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  work_date date not null,
  requested_clock_in_at timestamptz,
  requested_clock_out_at timestamptz,
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  approval_document_id uuid references public.approval_documents (id) on delete set null,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles (id) on delete set null,
  is_demo boolean not null default public.is_demo_actor(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  constraint attendance_correction_has_change check (requested_clock_in_at is not null or requested_clock_out_at is not null)
);

create index if not exists attendance_correction_requests_user_id_idx on public.attendance_correction_requests (user_id);
create index if not exists attendance_correction_requests_approval_document_id_idx on public.attendance_correction_requests (approval_document_id);
create index if not exists attendance_correction_requests_tenant_id_idx on public.attendance_correction_requests (tenant_id);

alter table public.attendance_correction_requests enable row level security;

create policy "attendance_correction_requests_select" on public.attendance_correction_requests
  for select using (user_id = auth.uid() or public.is_admin());
create policy "attendance_correction_requests_insert_own" on public.attendance_correction_requests
  for insert with check (user_id = auth.uid());
create policy "attendance_correction_requests_delete_own_pending" on public.attendance_correction_requests
  for delete using (user_id = auth.uid() and status = 'pending');

create policy "attendance_correction_requests_demo_isolation" on public.attendance_correction_requests
  as restrictive for all
  using (is_demo = public.is_demo_actor()) with check (is_demo = public.is_demo_actor());
create policy "attendance_correction_requests_tenant_isolation" on public.attendance_correction_requests
  as restrictive for all
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

-- 정정 신청 + 결재선을 원자적으로 만든다.
create or replace function public.submit_attendance_correction(
  p_work_date date,
  p_requested_clock_in_at timestamptz,
  p_requested_clock_out_at timestamptz,
  p_reason text,
  p_approver_ids uuid[],
  p_reference_ids uuid[] default '{}'
)
returns uuid
language plpgsql
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_name text;
  v_request_id uuid;
  v_doc_id uuid;
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;
  if p_requested_clock_in_at is null and p_requested_clock_out_at is null then
    raise exception '정정할 출근 또는 퇴근 시간을 하나 이상 입력해주세요.';
  end if;
  if p_reason is null or trim(p_reason) = '' then
    raise exception '정정 사유를 입력해주세요.';
  end if;
  if p_approver_ids is null or array_length(p_approver_ids, 1) is null then
    raise exception '결재선(승인자)을 1명 이상 지정해주세요.';
  end if;

  select full_name into v_actor_name from public.profiles where id = v_actor;

  v_doc_id := public.submit_approval_document(
    coalesce(v_actor_name, '구성원') || '의 근태 정정 신청 (' || p_work_date || ')',
    p_reason,
    p_approver_ids,
    p_reference_ids
  );

  insert into public.attendance_correction_requests
    (user_id, work_date, requested_clock_in_at, requested_clock_out_at, reason, approval_document_id)
  values (v_actor, p_work_date, p_requested_clock_in_at, p_requested_clock_out_at, p_reason, v_doc_id)
  returning id into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function public.submit_attendance_correction(date, timestamptz, timestamptz, text, uuid[], uuid[]) from public;
grant execute on function public.submit_attendance_correction(date, timestamptz, timestamptz, text, uuid[], uuid[]) to authenticated;

-- 결재가 끝나면 신청 상태를 반영하고, 승인된 경우 실제 attendance_records를
-- 고친다(신청에서 지정하지 않은 쪽 시간은 기존 값을 그대로 둔다).
create or replace function public.sync_attendance_correction_from_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_decided_by uuid;
  v_req record;
begin
  if new.status not in ('approved', 'rejected') or new.status = old.status then
    return new;
  end if;

  select * into v_req from public.attendance_correction_requests
  where approval_document_id = new.id and status = 'pending';

  if v_req.id is null then
    return new;
  end if;

  select decided_by into v_decided_by
  from public.approval_steps
  where document_id = new.id and role = 'approver' and decided_by is not null
  order by step_order desc
  limit 1;

  update public.attendance_correction_requests
  set status = new.status, decided_at = new.decided_at, decided_by = v_decided_by
  where id = v_req.id;

  if new.status = 'approved' then
    insert into public.attendance_records (user_id, work_date, clock_in_at, clock_out_at)
    values (v_req.user_id, v_req.work_date, v_req.requested_clock_in_at, v_req.requested_clock_out_at)
    on conflict (user_id, work_date) do update
    set
      clock_in_at = coalesce(excluded.clock_in_at, public.attendance_records.clock_in_at),
      clock_out_at = coalesce(excluded.clock_out_at, public.attendance_records.clock_out_at);
  end if;

  return new;
end;
$$;

drop trigger if exists sync_attendance_correction_from_approval_trigger on public.approval_documents;
create trigger sync_attendance_correction_from_approval_trigger
  after update on public.approval_documents
  for each row execute procedure public.sync_attendance_correction_from_approval();
