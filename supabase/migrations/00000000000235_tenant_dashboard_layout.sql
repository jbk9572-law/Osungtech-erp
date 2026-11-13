-- 회사 기본 메인 화면 배치 — 관리자가 저장하면, 개인 배치(ui_dashboard_layout)를 따로 저장하지 않은 모든
-- 직원에게 이 배치가 기본으로 보인다. 개인 배치가 있으면 개인 것이 우선이고, "기본값으로"를 누르면 이 회사 기본으로 돌아간다.
-- 회사당 한 행. 읽기는 같은 회사 직원 누구나, 쓰기는 관리자만. layout은 개인 배치와 같은 모양이며
-- 읽을 때 앱이 항상 검증·보정한다(src/lib/dashboard-layout.ts). DB에서는 용량만 막는다.
create table if not exists public.tenant_dashboard_layout (
  tenant_id uuid primary key default public.current_tenant_id() references public.tenants (id) on delete cascade,
  layout jsonb not null,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint tenant_dashboard_layout_size check (pg_column_size(layout) <= 8192)
);

alter table public.tenant_dashboard_layout enable row level security;

create policy "tenant_dashboard_layout_tenant_isolation" on public.tenant_dashboard_layout
  as restrictive
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy "tenant_dashboard_layout_select" on public.tenant_dashboard_layout
  for select using (tenant_id = public.current_tenant_id());
create policy "tenant_dashboard_layout_insert_admin" on public.tenant_dashboard_layout
  for insert with check (public.is_admin());
create policy "tenant_dashboard_layout_update_admin" on public.tenant_dashboard_layout
  for update using (public.is_admin()) with check (public.is_admin());
create policy "tenant_dashboard_layout_delete_admin" on public.tenant_dashboard_layout
  for delete using (public.is_admin());
