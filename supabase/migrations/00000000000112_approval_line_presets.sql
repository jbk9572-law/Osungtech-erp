-- 공유 결재라인 — 자주 쓰는 결재선(결재자/참조자 순서 조합)을 이름 붙여
-- 저장해두고, 새 기안을 쓸 때마다 조직도를 다시 펼쳐 고르지 않아도
-- 불러와 쓸 수 있게 한다. 회사 전체가 같이 쓰는 자원이라 조회는 로그인한
-- 누구나 가능하고(거래처/품목 등 다른 참조성 테이블과 같은 방침), 수정
-- 삭제는 만든 사람 본인과 관리자만 가능하다.
create table if not exists public.approval_line_presets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  approver_ids uuid[] not null default '{}',
  reference_ids uuid[] not null default '{}',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  is_demo boolean not null default public.is_demo_actor(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  constraint approval_line_presets_name_not_blank check (trim(name) <> ''),
  constraint approval_line_presets_has_approver check (array_length(approver_ids, 1) > 0)
);

create index if not exists approval_line_presets_tenant_id_idx on public.approval_line_presets (tenant_id);

alter table public.approval_line_presets enable row level security;

create policy "approval_line_presets_select" on public.approval_line_presets
  for select using (auth.role() = 'authenticated');
create policy "approval_line_presets_insert" on public.approval_line_presets
  for insert with check (auth.role() = 'authenticated');
create policy "approval_line_presets_update" on public.approval_line_presets
  for update using (created_by = auth.uid() or public.is_admin());
create policy "approval_line_presets_delete" on public.approval_line_presets
  for delete using (created_by = auth.uid() or public.is_admin());

create policy "approval_line_presets_demo_isolation" on public.approval_line_presets
  as restrictive for all
  using (is_demo = public.is_demo_actor()) with check (is_demo = public.is_demo_actor());
create policy "approval_line_presets_tenant_isolation" on public.approval_line_presets
  as restrictive for all
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

-- 결재매트릭스 — 결재양식(document_templates, category='approval') 하나당
-- 자동으로 연결할 결재선(preset)을 지정해둔다. 새 기안에서 그 양식을
-- 고르면 결재선을 자동으로 채워 제안하되(강제 고정은 아님 — 사람이 여전히
-- 바꿀 수 있다), 매번 결재선을 처음부터 다시 짜는 수고를 던다. 양식 하나엔
-- 규칙이 최대 1개만 있으면 되므로 template_id를 유니크로 둔다.
create table if not exists public.approval_matrix_rules (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null unique references public.document_templates (id) on delete cascade,
  preset_id uuid not null references public.approval_line_presets (id) on delete cascade,
  created_at timestamptz not null default now(),
  is_demo boolean not null default public.is_demo_actor(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id)
);

create index if not exists approval_matrix_rules_tenant_id_idx on public.approval_matrix_rules (tenant_id);

alter table public.approval_matrix_rules enable row level security;

create policy "approval_matrix_rules_select" on public.approval_matrix_rules
  for select using (auth.role() = 'authenticated');
create policy "approval_matrix_rules_insert" on public.approval_matrix_rules
  for insert with check (public.is_admin());
create policy "approval_matrix_rules_update" on public.approval_matrix_rules
  for update using (public.is_admin());
create policy "approval_matrix_rules_delete" on public.approval_matrix_rules
  for delete using (public.is_admin());

create policy "approval_matrix_rules_demo_isolation" on public.approval_matrix_rules
  as restrictive for all
  using (is_demo = public.is_demo_actor()) with check (is_demo = public.is_demo_actor());
create policy "approval_matrix_rules_tenant_isolation" on public.approval_matrix_rules
  as restrictive for all
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());
