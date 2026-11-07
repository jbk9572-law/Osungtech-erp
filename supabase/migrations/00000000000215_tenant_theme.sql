-- "모던" 테마를 브라우저(localStorage)가 아니라 회사(테넌트) 단위로
-- 바꿀 수 있게 한다(사용자 요청: "관리자페이지에서 모던이아니라 관리자
-- 페이지에서 모던으로 바꾸면 전체 변경되는건데 그걸 업체별로 변경할수
-- 있게 해줘" — 플랫폼관리자 > 환경설정에 테마 드롭다운 옆에 업체선택
-- 드롭다운을 둬서, 회사마다 다른 테마를 지정할 수 있어야 한다).
--
-- 지금까지(직전 두 커밋)는 테마를 이 브라우저의 localStorage에만 저장해
-- 같은 브라우저로 보는 전체 화면에 적용했는데, 이러면 "회사 A는 모던,
-- 회사 B는 기본"처럼 회사별로 다르게 둘 방법이 없다(플랫폼관리자 본인
-- 브라우저 하나에 값이 하나뿐이라서). tenants 테이블에 theme 컬럼을
-- 두고 서버에서 그 테넌트의 현재 설정을 읽어 렌더링하면, 회사마다 다른
-- 값을 그대로 가질 수 있고 클라이언트 JS/localStorage 없이 서버에서
-- 바로 적용되니 깜빡임(FOUC) 문제도 아예 없어진다.
alter table public.tenants
  add column if not exists theme text not null default 'classic-light';

alter table public.tenants
  drop constraint if exists tenants_theme_check;
alter table public.tenants
  add constraint tenants_theme_check check (theme in ('classic-light', 'modern'));

-- get_dashboard_layout_bootstrap()(migration 197)의 tenant 서브쿼리에
-- theme을 추가한다 — (dashboard)/layout.tsx가 이미 이 RPC 하나로 왕복을
-- 묶어서 쓰고 있어서, 여기 얹으면 추가 쿼리 없이 바로 쓸 수 있다.
create or replace function public.get_dashboard_layout_bootstrap()
returns jsonb
language sql
set search_path = public
stable
as $$
  select jsonb_build_object(
    'company', (
      select jsonb_build_object('name', name, 'logo_mark_url', logo_mark_url)
      from public.company_profile
      limit 1
    ),
    'profile', (
      select jsonb_build_object('is_demo', is_demo, 'role', role, 'department_id', department_id)
      from public.profiles
      where id = auth.uid()
    ),
    'tenant', (
      select jsonb_build_object('disabled_features', coalesce(disabled_features, '{}'::text[]), 'theme', theme)
      from public.tenants
      where id = public.current_tenant_id()
    ),
    'is_platform_admin', public.is_platform_admin(),
    'announcements', (
      select coalesce(jsonb_agg(jsonb_build_object('id', id, 'title', title)), '[]'::jsonb)
      from (
        select id, title
        from public.platform_announcements
        where is_active = true
        order by created_at desc
        limit 20
      ) a
    ),
    'platform_settings', (
      select jsonb_build_object('maintenance_mode', maintenance_mode, 'maintenance_message', maintenance_message)
      from public.platform_settings
      where id = true
    ),
    'department_page_access', (
      select coalesce(jsonb_agg(jsonb_build_object('page_key', page_key, 'department_id', department_id)), '[]'::jsonb)
      from public.department_page_access
    ),
    'quota', (
      select jsonb_build_object(
        'db_bytes_used', db_bytes_used,
        'db_quota_bytes', db_quota_bytes,
        'db_pct', db_pct,
        'file_bytes_used', file_bytes_used,
        'file_quota_bytes', file_quota_bytes,
        'file_pct', file_pct
      )
      from public.get_tenant_quota_status()
    )
  );
$$;

-- get_platform_tenant_list()(migration 199)에 theme을 추가한다 —
-- 플랫폼관리자 > 환경설정의 업체선택 드롭다운이 "그 회사 지금 테마가
-- 뭔지"를 같이 보여주고 고를 수 있어야 하는데, tenants RLS 경로가
-- 플랫폼 운영자에게도 전체를 안 보여주는 기존 결함(migration 199 주석
-- 참고) 때문에 평범한 .from("tenants") 대신 이미 검증된 이 RPC를
-- 그대로 확장해서 쓴다. Postgres는 CREATE OR REPLACE로 RETURNS TABLE의
-- 컬럼 구성 자체를 바꾸는 건 허용하지 않아서(ERROR: cannot change
-- return type of existing function — 실제 CI에서 이 에러로 막혔다),
-- 새 컬럼을 추가하려면 먼저 DROP FUNCTION이 필요하다.
drop function if exists public.get_platform_tenant_list();
create function public.get_platform_tenant_list()
returns table (
  id uuid,
  name text,
  slug text,
  created_at timestamptz,
  disabled_at timestamptz,
  plan text,
  plan_expires_at timestamptz,
  theme text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception '플랫폼 운영자만 조회할 수 있습니다.';
  end if;

  return query
    select t.id, t.name, t.slug, t.created_at, t.disabled_at, t.plan, t.plan_expires_at, t.theme
    from public.tenants t
    order by t.created_at asc
    limit 1000;
end;
$$;

revoke all on function public.get_platform_tenant_list() from public;
grant execute on function public.get_platform_tenant_list() to authenticated;

-- 테마 변경 자체 — set_tenant_sandbox()(migration 212)와 완전히 같은
-- 모양(플랫폼 운영자만, 값 검증 후 단순 update).
create or replace function public.set_tenant_theme(p_tenant_id uuid, p_theme text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception '플랫폼 운영자만 변경할 수 있습니다.';
  end if;
  if p_theme not in ('classic-light', 'modern') then
    raise exception '알 수 없는 테마입니다.';
  end if;
  update public.tenants set theme = p_theme where id = p_tenant_id;
end;
$$;

revoke all on function public.set_tenant_theme(uuid, text) from public;
grant execute on function public.set_tenant_theme(uuid, text) to authenticated;
