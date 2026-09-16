-- 인사관리 급여계산 1차 범위.
--
-- 소득세/지방소득세 원천징수(국세청 간이세액표 조회)는 이번 범위에서
-- 뺀다 — 부양가족 수 등 개인 정보까지 얽힌 별도 조회표라 잘못 넣으면
-- 그대로 급여 산정 오류로 이어진다. 4대보험(국민연금/건강보험/장기
-- 요양보험/고용보험) 공제까지만 계산하고, 실지급액에는 "소득세는
-- 별도"라는 점을 화면에 명시한다.
--
-- 요율(payroll_rate_settings)은 leave_balances와 같은 원칙 — 노동법/
-- 4대보험 요율은 매년 바뀌는 법정 수치라 자동 계산에 넣지 않고, 관리자가
-- 정부 고시를 확인해서 직접 입력한다. last_confirmed_at으로 "언제
-- 마지막으로 확인했는지"를 화면에 보여줘서, 오래 방치되면 눈에 띄게 한다.

create table if not exists public.payroll_rate_settings (
  id uuid primary key default gen_random_uuid(),
  year integer not null,
  min_wage_hourly numeric not null default 0,
  national_pension_rate numeric not null default 0,
  health_insurance_rate numeric not null default 0,
  -- 장기요양보험료는 보수총액이 아니라 "건강보험료의 몇 %"로 고시된다.
  long_term_care_rate numeric not null default 0,
  employment_insurance_rate numeric not null default 0,
  source_note text,
  last_confirmed_at date,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,
  is_demo boolean not null default public.is_demo_actor(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  unique (tenant_id, year, is_demo)
);

create table if not exists public.employee_pay_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  monthly_base_pay numeric not null default 0,
  updated_at timestamptz not null default now(),
  is_demo boolean not null default public.is_demo_actor(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  unique (user_id)
);

create table if not exists public.payslips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  pay_month text not null,
  base_pay numeric not null default 0,
  gross_pay numeric not null default 0,
  pension_deduction numeric not null default 0,
  health_deduction numeric not null default 0,
  long_term_care_deduction numeric not null default 0,
  employment_deduction numeric not null default 0,
  total_deduction numeric not null default 0,
  net_pay numeric not null default 0,
  rate_year integer not null,
  status text not null default 'draft' check (status in ('draft', 'confirmed')),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  confirmed_by uuid references public.profiles (id) on delete set null,
  is_demo boolean not null default public.is_demo_actor(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  unique (user_id, pay_month)
);

create index if not exists payroll_rate_settings_tenant_id_idx on public.payroll_rate_settings (tenant_id);
create index if not exists employee_pay_settings_tenant_id_idx on public.employee_pay_settings (tenant_id);
create index if not exists payslips_pay_month_idx on public.payslips (pay_month);
create index if not exists payslips_tenant_id_idx on public.payslips (tenant_id);

alter table public.payroll_rate_settings enable row level security;
alter table public.employee_pay_settings enable row level security;
alter table public.payslips enable row level security;

-- 요율 자체는 비밀이 아니라 급여명세를 보는 누구나 "어떤 기준으로
-- 계산됐는지" 알 수 있어야 하므로 조회는 로그인한 누구나, 설정은 관리자만.
create policy "payroll_rate_settings_select" on public.payroll_rate_settings
  for select using (auth.role() = 'authenticated');
create policy "payroll_rate_settings_upsert_admin" on public.payroll_rate_settings
  for insert with check (public.is_admin());
create policy "payroll_rate_settings_update_admin" on public.payroll_rate_settings
  for update using (public.is_admin());

-- 급여정보(월 기본급)는 민감정보라 본인과 관리자만.
create policy "employee_pay_settings_select" on public.employee_pay_settings
  for select using (user_id = auth.uid() or public.is_admin());
create policy "employee_pay_settings_upsert_admin" on public.employee_pay_settings
  for insert with check (public.is_admin());
create policy "employee_pay_settings_update_admin" on public.employee_pay_settings
  for update using (public.is_admin());

-- 급여명세도 마찬가지로 본인과 관리자만.
create policy "payslips_select" on public.payslips
  for select using (user_id = auth.uid() or public.is_admin());
create policy "payslips_insert_admin" on public.payslips
  for insert with check (public.is_admin());
create policy "payslips_update_admin" on public.payslips
  for update using (public.is_admin());

create policy "payroll_rate_settings_demo_isolation" on public.payroll_rate_settings
  as restrictive for all
  using (is_demo = public.is_demo_actor()) with check (is_demo = public.is_demo_actor());
create policy "payroll_rate_settings_tenant_isolation" on public.payroll_rate_settings
  as restrictive for all
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());
create policy "employee_pay_settings_demo_isolation" on public.employee_pay_settings
  as restrictive for all
  using (is_demo = public.is_demo_actor()) with check (is_demo = public.is_demo_actor());
create policy "employee_pay_settings_tenant_isolation" on public.employee_pay_settings
  as restrictive for all
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());
create policy "payslips_demo_isolation" on public.payslips
  as restrictive for all
  using (is_demo = public.is_demo_actor()) with check (is_demo = public.is_demo_actor());
create policy "payslips_tenant_isolation" on public.payslips
  as restrictive for all
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());
