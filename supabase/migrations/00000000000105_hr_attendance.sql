-- 인사관리 1차 범위: 근태(출퇴근 기록) + 휴가 신청/승인 + 연차 총일수
-- 관리. 급여 계산(4대보험/최저임금 등 법정 요율)은 여기 포함하지 않는다
-- — 그건 매년/비정기로 바뀌는 법정 수치를 다루는 별도 범위라 설정값
-- 테이블 + 정기 확인 루틴까지 갖춰서 다음에 따로 만든다.
--
-- 연차 "잔여일수" 계산에 노동법상 발생 규칙(1년 미만 매월 1일, 1년 이상
-- 가산 등)을 자동으로 넣지 않는다 — 그 규칙 자체가 법적으로 정확해야
-- 하는 영역이라 잘못 계산하면 그대로 법적 리스크가 된다. 대신
-- leave_balances.total_days를 관리자가 직접 입력하게 하고(노무사 확인
-- 등 회사가 스스로 정한 값), 여기서는 그 값에서 승인된 휴가일수를
-- 뺀 단순 산수만 한다.

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  work_date date not null default current_date,
  clock_in_at timestamptz,
  clock_out_at timestamptz,
  created_at timestamptz not null default now(),
  is_demo boolean not null default public.is_demo_actor(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  unique (user_id, work_date)
);

create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  start_date date not null,
  end_date date not null,
  days numeric not null check (days > 0),
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles (id) on delete set null,
  is_demo boolean not null default public.is_demo_actor(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  constraint leave_requests_date_order check (end_date >= start_date)
);

create table if not exists public.leave_balances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  year integer not null,
  total_days numeric not null default 0,
  updated_at timestamptz not null default now(),
  is_demo boolean not null default public.is_demo_actor(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  unique (user_id, year)
);

create index if not exists attendance_records_user_date_idx on public.attendance_records (user_id, work_date desc);
create index if not exists attendance_records_tenant_id_idx on public.attendance_records (tenant_id);
create index if not exists leave_requests_user_id_idx on public.leave_requests (user_id);
create index if not exists leave_requests_tenant_id_idx on public.leave_requests (tenant_id);
create index if not exists leave_balances_tenant_id_idx on public.leave_balances (tenant_id);

alter table public.attendance_records enable row level security;
alter table public.leave_requests enable row level security;
alter table public.leave_balances enable row level security;

-- 근태: 본인 기록은 본인이 직접 찍고(출근/퇴근), 관리자는 전체를 볼 수
-- 있다(관리자 화면에서 팀 근태 확인 용도). 수정은 본인 것만 — 지각/조퇴
-- 정정 같은 관리자 대리입력은 지금 범위 밖.
create policy "attendance_records_select" on public.attendance_records
  for select using (user_id = auth.uid() or public.is_admin());
create policy "attendance_records_insert_own" on public.attendance_records
  for insert with check (user_id = auth.uid());
create policy "attendance_records_update_own" on public.attendance_records
  for update using (user_id = auth.uid());

-- 휴가 신청: 본인 신청 + 관리자는 전체 조회(승인 대기 목록). 상태 변경
-- (승인/반려)은 관리자만.
create policy "leave_requests_select" on public.leave_requests
  for select using (user_id = auth.uid() or public.is_admin());
create policy "leave_requests_insert_own" on public.leave_requests
  for insert with check (user_id = auth.uid());
create policy "leave_requests_decide_admin" on public.leave_requests
  for update using (public.is_admin());
create policy "leave_requests_delete_own_pending" on public.leave_requests
  for delete using (user_id = auth.uid() and status = 'pending');

-- 연차 총일수: 본인은 조회만, 설정(등록/수정)은 관리자만.
create policy "leave_balances_select" on public.leave_balances
  for select using (user_id = auth.uid() or public.is_admin());
create policy "leave_balances_upsert_admin" on public.leave_balances
  for insert with check (public.is_admin());
create policy "leave_balances_update_admin" on public.leave_balances
  for update using (public.is_admin());

create policy "attendance_records_demo_isolation" on public.attendance_records
  as restrictive for all
  using (is_demo = public.is_demo_actor()) with check (is_demo = public.is_demo_actor());
create policy "attendance_records_tenant_isolation" on public.attendance_records
  as restrictive for all
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());
create policy "leave_requests_demo_isolation" on public.leave_requests
  as restrictive for all
  using (is_demo = public.is_demo_actor()) with check (is_demo = public.is_demo_actor());
create policy "leave_requests_tenant_isolation" on public.leave_requests
  as restrictive for all
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());
create policy "leave_balances_demo_isolation" on public.leave_balances
  as restrictive for all
  using (is_demo = public.is_demo_actor()) with check (is_demo = public.is_demo_actor());
create policy "leave_balances_tenant_isolation" on public.leave_balances
  as restrictive for all
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());
