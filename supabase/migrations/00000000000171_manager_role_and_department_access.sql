-- 사용자 피드백 3건을 한 마이그레이션으로 처리한다.
--
-- 1) 공지사항 작성이 전 직원 누구나 가능했다 — 일반 직원이 회사 전체에
--    뜨는 공지를 올릴 수 있는 건 의도가 아니라는 지적. 관리자/매니저만
--    작성 가능하게 좁힌다.
-- 2) 운영자 문의(settings/support)가 화면엔 "내 문의 이력"이라고
--    돼있지만 실제로는 같은 회사 누구 문의든 다 보이는 버그였다 —
--    작성/열람 모두 관리자+매니저로 좁히기로 함(일반 직원이 쓰는 채널이
--    아니라 회사를 대표해 운영자와 소통하는 공식 채널로 본다).
-- 3) 미수금현황/미지급금현황/하청업체관리/외주비정산처럼 민감한 화면을
--    부서 단위로 세밀하게 열람 제한할 수 있는 체계가 아예 없었다 —
--    department_page_access 테이블을 새로 만든다(설정 없는 page_key는
--    기본 전체공개 — 관리자가 opt-in으로 특정 화면만 특정 부서에 묶는
--    방식. 전부 막아버리는 기본값이면 마이그레이션 직후 아무도 못 보는
--    화면이 생길 수 있어 위험하다).

-- is_admin()과 같은 패턴 — "관리자 또는 매니저인가"를 한 곳에서
-- 판정한다. 앞으로 이 기준(어떤 role들이 포함되는지)이 바뀌어도 이
-- 함수만 고치면 된다.
create or replace function public.is_manager_or_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles me
    where me.id = auth.uid() and me.role in ('admin', 'manager')
  );
$$;

revoke all on function public.is_manager_or_admin() from public;
grant execute on function public.is_manager_or_admin() to authenticated;

-- [1] 공지사항 작성 권한 좁히기 — 수정/삭제는 이미 migration 70에서
-- owner_or_admin으로 좁혀져 있었는데, 작성(insert)만 누구나였다.
drop policy if exists "announcements_insert_authenticated" on public.announcements;
create policy "announcements_insert_manager_or_admin" on public.announcements
  for insert with check (public.is_manager_or_admin());

-- [2] 운영자 문의 — 작성/열람 모두 관리자+매니저로. 플랫폼 운영자는
-- tenant_isolation RESTRICTIVE 정책에서 이미 "내 테넌트이거나 플랫폼
-- 운영자"로 전 테넌트를 보게 돼 있으므로, 여기 PERMISSIVE select
-- 정책에도 그 조건을 그대로 얹어야 한다 — 안 그러면 플랫폼 운영자 본인
-- 테넌트 프로필의 role이 admin/manager가 아닐 경우 막혀버린다.
drop policy if exists "support_tickets_select_authenticated" on public.support_tickets;
create policy "support_tickets_select_manager_or_admin" on public.support_tickets
  for select using (public.is_manager_or_admin() or public.is_platform_admin());
drop policy if exists "support_tickets_insert_authenticated" on public.support_tickets;
create policy "support_tickets_insert_manager_or_admin" on public.support_tickets
  for insert with check (public.is_manager_or_admin());

-- [3] 화면별 부서 접근 제한 — sales_orders/purchase_orders처럼 여러
-- 화면이 같이 쓰는 원천 테이블에는 걸 수 없다(미수금현황이 쓰는
-- sales_orders를 RLS로 막으면 매출관리 화면까지 같이 막힌다). 그래서
-- 테이블 단이 아니라 "화면(page_key) 단위 접근 허용 목록"을 따로 두고,
-- 각 화면의 서버 컴포넌트가 직접 확인하는 app-level 게이트로 쓴다 —
-- adminOnly 화면들이 지금까지 해온 "관리자만 볼 수 있습니다" 벽과 같은
-- 수준의 보안 경계이지 그 이상도 이하도 아니다.
create table public.department_page_access (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  page_key text not null,
  department_id uuid not null references public.departments (id) on delete cascade,
  is_demo boolean not null default public.is_demo_actor(),
  created_at timestamptz not null default now(),
  unique (tenant_id, page_key, department_id)
);

create index department_page_access_page_key_idx on public.department_page_access (tenant_id, page_key);

alter table public.department_page_access enable row level security;

-- 열람 제한 여부를 계산하려면 로그인한 누구나 이 표를 읽을 수 있어야
-- 한다(departments_select과 같은 이유) — 설정 변경은 관리자만.
create policy "department_page_access_select" on public.department_page_access
  for select using (auth.role() = 'authenticated');
create policy "department_page_access_insert_admin" on public.department_page_access
  for insert with check (public.is_admin());
create policy "department_page_access_delete_admin" on public.department_page_access
  for delete using (public.is_admin());

create policy "department_page_access_demo_isolation" on public.department_page_access
  as restrictive for all
  using (is_demo = public.is_demo_actor()) with check (is_demo = public.is_demo_actor());
create policy "department_page_access_tenant_isolation" on public.department_page_access
  as restrictive for all
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

-- [부록] 기안함 UX 감사(task_9f9942c3)에서 남아있던 죽은 오버로드 정리 —
-- migration 102의 3-arg submit_approval_document가 migration 110의
-- 4-arg 버전으로 교체될 의도였는데, Postgres는 매개변수 목록이 다르면
-- "교체"가 아니라 "새 오버로드 추가"로 처리해 둘 다 남아있었다. 이제
-- 와서 3-arg 버전을 쓰는 코드가 없는 걸 확인하고 지운다.
drop function if exists public.submit_approval_document(text, text, uuid[]);
