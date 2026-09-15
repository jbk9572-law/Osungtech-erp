-- 문서 템플릿(공용) 엔진 — 인사서류(근로계약서 등)와 전자결재 기안서가
-- 같은 구조를 공유한다: {{병합필드}}가 있는 양식(document_templates)을
-- 골라 값을 채우면 완성된 문서(document_instances)가 생긴다. 나중에
-- 재직증명서/품의서 등을 추가할 때도 새 템플릿만 등록하면 되고, 이
-- 두 테이블/화면을 다시 만들 필요가 없다.
--
-- 실제 법정 서식(표준근로계약서 등)의 정확한 문구는 여기서 미리 심어
-- 넣지 않는다 — 고용노동부가 배포하는 공식 양식을 관리자가 그대로
-- 붙여넣어 등록하는 게 맞다(직접 지어낸 문구를 법적 서식인 것처럼
-- 심어두면 그 자체가 리스크다). 이 마이그레이션은 빈 템플릿 관리
-- 기능만 만든다.

create table if not exists public.document_templates (
  id uuid primary key default gen_random_uuid(),
  category text not null default 'general' check (category in ('hr_contract', 'hr_certificate', 'approval', 'general')),
  name text not null,
  body text not null default '',
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_demo boolean not null default public.is_demo_actor(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id)
);

create table if not exists public.document_instances (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references public.document_templates (id) on delete set null,
  category text not null default 'general',
  title text not null,
  subject_user_id uuid references public.profiles (id) on delete set null,
  field_values jsonb not null default '{}'::jsonb,
  -- 생성 시점 값으로 치환된 최종 본문 스냅샷 — 나중에 템플릿을 고치거나
  -- 지워도 이미 발급된 문서 내용은 그대로 남는다(계산서 등 다른 확정
  -- 문서들과 같은 원칙).
  rendered_body text not null default '',
  status text not null default 'draft' check (status in ('draft', 'issued')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  issued_at timestamptz,
  is_demo boolean not null default public.is_demo_actor(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id)
);

create index if not exists document_templates_category_idx on public.document_templates (category);
create index if not exists document_templates_tenant_id_idx on public.document_templates (tenant_id);
create index if not exists document_instances_subject_user_id_idx on public.document_instances (subject_user_id);
create index if not exists document_instances_created_by_idx on public.document_instances (created_by);
create index if not exists document_instances_tenant_id_idx on public.document_instances (tenant_id);

alter table public.document_templates enable row level security;
alter table public.document_instances enable row level security;

-- 템플릿 목록은 문서를 만들 때 골라야 하니 로그인한 누구나 조회 가능,
-- 등록/수정/삭제는 관리자만(회사 공식 양식이라 아무나 바꾸면 안 됨).
create policy "document_templates_select" on public.document_templates
  for select using (auth.role() = 'authenticated');
create policy "document_templates_insert_admin" on public.document_templates
  for insert with check (public.is_admin());
create policy "document_templates_update_admin" on public.document_templates
  for update using (public.is_admin());
create policy "document_templates_delete_admin" on public.document_templates
  for delete using (public.is_admin());

-- 생성된 문서는 만든 사람, 당사자(subject_user_id), 관리자만 볼 수 있다
-- — 근로계약서 등 개인정보가 담기는 문서라 나머지 업무 테이블처럼
-- 전체공개하지 않는다.
create policy "document_instances_select" on public.document_instances
  for select using (
    created_by = auth.uid() or subject_user_id = auth.uid() or public.is_admin()
  );
create policy "document_instances_insert" on public.document_instances
  for insert with check (auth.role() = 'authenticated');
create policy "document_instances_update_own" on public.document_instances
  for update using (created_by = auth.uid() or public.is_admin());
create policy "document_instances_delete_own" on public.document_instances
  for delete using (created_by = auth.uid() or public.is_admin());

create policy "document_templates_demo_isolation" on public.document_templates
  as restrictive for all
  using (is_demo = public.is_demo_actor()) with check (is_demo = public.is_demo_actor());
create policy "document_templates_tenant_isolation" on public.document_templates
  as restrictive for all
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());
create policy "document_instances_demo_isolation" on public.document_instances
  as restrictive for all
  using (is_demo = public.is_demo_actor()) with check (is_demo = public.is_demo_actor());
create policy "document_instances_tenant_isolation" on public.document_instances
  as restrictive for all
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());
