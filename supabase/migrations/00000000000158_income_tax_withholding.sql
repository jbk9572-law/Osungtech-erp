-- 소득세/지방소득세 원천징수 — 4대보험처럼 "요율 %"로 계산되는 게 아니라
-- 국세청이 고시하는 "근로소득 간이세액표"(월급여 구간 × 부양가족수(1~11명)
-- 조합별 세액)를 그대로 조회해서 뗀다. 이 표 자체(실제 세액 숫자)는 매우
-- 방대하고(수백~수천 구간) 주기적으로 개정되며, 여기서 값을 지어내면
-- 실제 직원 월급에서 세금을 잘못 떼는 문제로 이어진다 — payroll_rate_
-- settings(4대보험 요율)와 같은 원칙으로, 표 내용은 절대 미리 심어두지
-- 않고 관리자가 홈택스에서 받은 최신 표를 직접 입력/업로드하게 한다.
create table if not exists public.withholding_tax_brackets (
  id uuid primary key default gen_random_uuid(),
  -- salary_from 이상 salary_to 미만(마지막 구간은 salary_to가 없으면
  -- "그 이상 전부"로 취급 — 간이세액표의 최고 구간과 같은 규칙).
  salary_from numeric not null,
  salary_to numeric,
  dependents_1 numeric not null default 0,
  dependents_2 numeric not null default 0,
  dependents_3 numeric not null default 0,
  dependents_4 numeric not null default 0,
  dependents_5 numeric not null default 0,
  dependents_6 numeric not null default 0,
  dependents_7 numeric not null default 0,
  dependents_8 numeric not null default 0,
  dependents_9 numeric not null default 0,
  dependents_10 numeric not null default 0,
  dependents_11 numeric not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,
  is_demo boolean not null default public.is_demo_actor(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  unique (tenant_id, salary_from, is_demo)
);

create index if not exists withholding_tax_brackets_tenant_salary_idx
  on public.withholding_tax_brackets (tenant_id, salary_from);

alter table public.withholding_tax_brackets enable row level security;

-- payroll_rate_settings와 같은 원칙 — 표 자체는 비밀이 아니라 급여명세를
-- 보는 누구나 "어떤 기준으로 계산됐는지" 알 수 있어야 하므로 조회는
-- 로그인한 누구나, 등록/수정/삭제는 관리자만.
create policy "withholding_tax_brackets_select" on public.withholding_tax_brackets
  for select using (auth.role() = 'authenticated');
create policy "withholding_tax_brackets_insert_admin" on public.withholding_tax_brackets
  for insert with check (public.is_admin());
create policy "withholding_tax_brackets_update_admin" on public.withholding_tax_brackets
  for update using (public.is_admin());
create policy "withholding_tax_brackets_delete_admin" on public.withholding_tax_brackets
  for delete using (public.is_admin());

create policy "withholding_tax_brackets_demo_isolation" on public.withholding_tax_brackets
  as restrictive for all
  using (is_demo = public.is_demo_actor()) with check (is_demo = public.is_demo_actor());
create policy "withholding_tax_brackets_tenant_isolation" on public.withholding_tax_brackets
  as restrictive for all
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

-- 부양가족 수(간이세액표 조회 키, 본인 포함 최소 1) — 월 기본급과 같이
-- 직원별로 한 번 설정해두고 급여명세 생성 때마다 그대로 쓰는 값이라
-- employee_pay_settings에 같이 둔다.
alter table public.employee_pay_settings
  add column if not exists dependents_count integer not null default 1;
alter table public.employee_pay_settings
  add constraint employee_pay_settings_dependents_count_check check (dependents_count >= 1);

-- 급여명세에 소득세/지방소득세 공제 항목 추가.
alter table public.payslips
  add column if not exists income_tax_deduction numeric not null default 0,
  add column if not exists local_income_tax_deduction numeric not null default 0;

comment on column public.payslips.income_tax_deduction is '근로소득 간이세액표 조회로 계산된 소득세 원천징수액';
comment on column public.payslips.local_income_tax_deduction is '지방소득세(소득세의 10%, 원단위 반올림)';
