-- 새 테마 "grid-modern"(모던 + 한국형 밀집 그리드)을 추가한다.
-- 테마 컬럼/RPC 구조는 migration 215·233 그대로 — 허용값과 set_tenant_theme()의 허용 목록만 늘린다.
-- 기본값은 classic-light 그대로라 기존 회사 화면은 바뀌지 않고, 플랫폼 운영자가 회사별로 골라 켠다.
alter table public.tenants
  drop constraint if exists tenants_theme_check;

alter table public.tenants
  add constraint tenants_theme_check check (theme in ('classic-light', 'grid-modern'));

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
  if p_theme not in ('classic-light', 'grid-modern') then
    raise exception '알 수 없는 테마입니다.';
  end if;
  update public.tenants set theme = p_theme where id = p_tenant_id;
end;
$$;

revoke all on function public.set_tenant_theme(uuid, text) from public;
grant execute on function public.set_tenant_theme(uuid, text) to authenticated;
