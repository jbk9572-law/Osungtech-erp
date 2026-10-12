-- 헌법검사 보류 항목 처리 — 연차 신청 시 잔여일수 검증을 "경고만"에서
-- "차단"으로 바꾸고(사용자 지정), 대신 관리자가 사유와 함께 추가 연차를
-- 부여할 수 있는 길을 열어둔다. 사용자 결정: "잔여 초과 시 신청 자체를
-- 막되, 결재권자가 사유와 함께 추가 연차를 부여할 수 있게" (대화 참고).
--
-- 1) submit_leave_request(): 잔여를 초과하는 신청이면 결재문서를 만들지
--    않고 바로 예외를 던진다(기존엔 결재 본문에 경고 문구만 덧붙이고
--    신청 자체는 그냥 통과시켰다).
-- 2) leave_grants 테이블 + grant_extra_leave() 신설 — 관리자가 특정
--    구성원에게 "+N일, 사유"로 연차를 증분 부여한다. leave_balances처럼
--    총일수를 덮어쓰는 게 아니라 기존 총일수에 더하는 방식이라, 기존
--    "연차 총일수 저장"(setLeaveBalance)과 별도 기능으로 둔다. 누가
--    언제 몇 일을 왜 부여했는지 이력이 남아야 감사 추적이 된다.

-- ── 1) 잔여 초과 신청 차단 ─────────────────────────────────────
create or replace function public.submit_leave_request(
  p_start_date date,
  p_end_date date,
  p_days numeric,
  p_reason text,
  p_approver_ids uuid[],
  p_reference_ids uuid[] default '{}',
  p_leave_unit text default 'full'
)
returns uuid
language plpgsql
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_name text;
  v_leave_id uuid;
  v_doc_id uuid;
  v_unit_label text;
  v_year integer := extract(year from p_start_date)::int;
  v_total_days numeric;
  v_used_days numeric;
  v_remaining numeric;
  v_balance_note text;
  v_content text;
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;
  if p_end_date < p_start_date then
    raise exception '종료일이 시작일보다 빠를 수 없습니다.';
  end if;
  if p_days is null or p_days <= 0 then
    raise exception '사용 일수를 올바르게 입력해주세요.';
  end if;
  if p_leave_unit not in ('full', 'half_am', 'half_pm', 'quarter_am', 'quarter_pm') then
    raise exception '잘못된 휴가 단위입니다.';
  end if;
  if p_leave_unit <> 'full' and p_start_date <> p_end_date then
    raise exception '반차/반반차는 하루만 신청할 수 있습니다.';
  end if;
  if p_approver_ids is null or array_length(p_approver_ids, 1) is null then
    raise exception '결재선(승인자)을 1명 이상 지정해주세요.';
  end if;

  select full_name into v_actor_name from public.profiles where id = v_actor;

  select total_days into v_total_days from public.leave_balances where user_id = v_actor and year = v_year;
  select coalesce(sum(days), 0) into v_used_days
  from public.leave_requests
  where user_id = v_actor and status = 'approved'
    and start_date >= make_date(v_year, 1, 1) and start_date <= make_date(v_year, 12, 31);
  v_remaining := coalesce(v_total_days, 0) - v_used_days;

  -- 예전엔 여기서 경고 문구만 결재 본문에 덧붙이고 신청은 그냥 통과시켰다.
  -- 이제는 잔여를 초과하면 신청 자체를 막는다 — 결재권자(관리자)가
  -- grant_extra_leave()로 추가 연차를 사유와 함께 부여한 뒤 다시
  -- 신청해야 한다.
  if v_remaining - p_days < 0 then
    raise exception '잔여 연차(%s일)가 이번 신청(%s일)보다 부족합니다. 관리자에게 추가 연차 부여를 요청한 뒤 다시 신청해주세요.', v_remaining, p_days;
  end if;

  v_balance_note := format(
    '[잔여 연차 안내] %s년 총 %s일 중 %s일 사용, 이번 신청(%s일) 전 잔여 %s일 → 신청 후 %s일',
    v_year, coalesce(v_total_days, 0), v_used_days, p_days, v_remaining, v_remaining - p_days
  );

  v_unit_label := case p_leave_unit
    when 'half_am' then ' (오전반차)'
    when 'half_pm' then ' (오후반차)'
    when 'quarter_am' then ' (오전반반차)'
    when 'quarter_pm' then ' (오후반반차)'
    else ''
  end;

  v_content := v_balance_note || E'\n\n' || coalesce(p_reason, '');

  v_doc_id := public.submit_approval_document(
    coalesce(v_actor_name, '구성원') || '의 연차 신청 (' || p_start_date || ' ~ ' || p_end_date || ', ' || p_days || '일)' || v_unit_label,
    v_content,
    p_approver_ids,
    p_reference_ids
  );

  insert into public.leave_requests (user_id, start_date, end_date, days, reason, approval_document_id, leave_unit)
  values (v_actor, p_start_date, p_end_date, p_days, p_reason, v_doc_id, p_leave_unit)
  returning id into v_leave_id;

  update public.approval_documents set source_type = 'leave_request', source_id = v_leave_id where id = v_doc_id;

  return v_leave_id;
end;
$$;

revoke all on function public.submit_leave_request(date, date, numeric, text, uuid[], uuid[], text) from public;
grant execute on function public.submit_leave_request(date, date, numeric, text, uuid[], uuid[], text) to authenticated;

-- ── 2) 관리자의 추가 연차 부여(사유 필수) ──────────────────────
create table if not exists public.leave_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  year integer not null,
  days numeric not null,
  reason text not null,
  granted_by uuid not null references public.profiles (id),
  granted_at timestamptz not null default now(),
  is_demo boolean not null default public.is_demo_actor(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id)
);

create index if not exists leave_grants_user_year_idx on public.leave_grants (user_id, year);
create index if not exists leave_grants_tenant_id_idx on public.leave_grants (tenant_id);

alter table public.leave_grants enable row level security;

-- 본인 이력 조회 + 관리자 전체 조회. 부여(insert)는 관리자만 — 총일수를
-- 직접 저장하는 leave_balances_upsert_admin과 같은 권한 경계.
create policy "leave_grants_select" on public.leave_grants
  for select using (user_id = auth.uid() or public.is_admin());
create policy "leave_grants_insert_admin" on public.leave_grants
  for insert with check (public.is_admin());

create policy "leave_grants_demo_isolation" on public.leave_grants
  as restrictive for all
  using (is_demo = public.is_demo_actor()) with check (is_demo = public.is_demo_actor());
create policy "leave_grants_tenant_isolation" on public.leave_grants
  as restrictive for all
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

-- leave_balances.total_days를 덮어쓰지 않고 더한다(leave_grants 이력과
-- 함께 한 트랜잭션으로). 호출자가 이미 관리자임을 직접 확인해, RLS가
-- 막더라도 여기서 먼저 알아볼 수 있는 한글 에러를 내게 한다.
create or replace function public.grant_extra_leave(
  p_user_id uuid,
  p_year integer,
  p_days numeric,
  p_reason text
)
returns numeric
language plpgsql
as $$
declare
  v_actor uuid := auth.uid();
  v_new_total numeric;
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;
  if not public.is_admin() then
    raise exception '관리자만 추가 연차를 부여할 수 있습니다.';
  end if;
  if p_days is null or p_days <= 0 then
    raise exception '부여할 일수를 올바르게 입력해주세요.';
  end if;
  if p_reason is null or trim(p_reason) = '' then
    raise exception '부여 사유를 입력해주세요.';
  end if;

  insert into public.leave_grants (user_id, year, days, reason, granted_by)
  values (p_user_id, p_year, p_days, trim(p_reason), v_actor);

  insert into public.leave_balances (user_id, year, total_days)
  values (p_user_id, p_year, p_days)
  on conflict (user_id, year)
  do update set total_days = public.leave_balances.total_days + excluded.total_days, updated_at = now()
  returning total_days into v_new_total;

  return v_new_total;
end;
$$;

revoke all on function public.grant_extra_leave(uuid, integer, numeric, text) from public;
grant execute on function public.grant_extra_leave(uuid, integer, numeric, text) to authenticated;
