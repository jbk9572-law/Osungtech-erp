-- 플랫폼 관리자(고객사) 화면의 "전체 테넌트" KPI는 get_platform_stats()
-- (SECURITY DEFINER, migration 129)로 세서 항상 정확했는데, 바로 아래
-- 고객사 목록은 .from("tenants").select(...) 평범한 조회라 RLS를 그대로
-- 통과해야 했다. tenants_select_platform_admin 정책(migration 121)이
-- is_platform_admin()이면 전체가 보이게 돼 있어야 하는데, 실제로는
-- 플랫폼 운영자 계정으로도 자기 테넌트 1개만 보이는 문제가 보고됐다 —
-- 정책 자체는 맞게 보여서(permissive OR), 정확한 원인을 더 캐기보다는
-- 이미 검증된 패턴(get_platform_stats처럼 SECURITY DEFINER RPC로 직접
-- 전체를 가져오기)으로 바꿔서 RLS 경로 자체에 더 이상 의존하지 않게
-- 한다 — 이 화면은 어차피 requirePlatformAdmin()으로 이미 한 번
-- 막혀 있어서(platform-admin/layout.tsx) 이중으로 안전하다.
create or replace function public.get_platform_tenant_list()
returns table (
  id uuid,
  name text,
  slug text,
  created_at timestamptz,
  disabled_at timestamptz,
  plan text,
  plan_expires_at timestamptz
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
    select t.id, t.name, t.slug, t.created_at, t.disabled_at, t.plan, t.plan_expires_at
    from public.tenants t
    order by t.created_at asc
    limit 1000;
end;
$$;

revoke all on function public.get_platform_tenant_list() from public;
grant execute on function public.get_platform_tenant_list() to authenticated;
