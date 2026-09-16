-- 조직구조(부서/직급) — 전자결재 결재선을 "직원 목록에서 아무나 고르기"가
-- 아니라 조직도(부서 트리) 기준으로 고를 수 있게 하기 위한 기반이다.
-- 나중에 전결권/결재매트릭스/공유 결재라인 등도 이 부서 구조 위에
-- 얹힌다.

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  parent_department_id uuid references public.departments (id) on delete set null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  is_demo boolean not null default public.is_demo_actor(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  constraint departments_no_self_parent check (id <> parent_department_id)
);

create index if not exists departments_parent_idx on public.departments (parent_department_id);
create index if not exists departments_tenant_id_idx on public.departments (tenant_id);

alter table public.departments enable row level security;

-- 조직도는 결재자를 고를 때 누구나 봐야 하므로 조회는 로그인한 누구나,
-- 구조 변경(부서 추가/이동/삭제)은 관리자만.
create policy "departments_select" on public.departments
  for select using (auth.role() = 'authenticated');
create policy "departments_insert_admin" on public.departments
  for insert with check (public.is_admin());
create policy "departments_update_admin" on public.departments
  for update using (public.is_admin());
create policy "departments_delete_admin" on public.departments
  for delete using (public.is_admin());

create policy "departments_demo_isolation" on public.departments
  as restrictive for all
  using (is_demo = public.is_demo_actor()) with check (is_demo = public.is_demo_actor());
create policy "departments_tenant_isolation" on public.departments
  as restrictive for all
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

alter table public.profiles add column if not exists department_id uuid references public.departments (id) on delete set null;
alter table public.profiles add column if not exists position_title text;

create index if not exists profiles_department_id_idx on public.profiles (department_id);
