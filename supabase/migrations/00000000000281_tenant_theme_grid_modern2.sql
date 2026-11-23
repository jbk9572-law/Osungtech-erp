-- 새 테마 "grid-modern2"(모던 + 규칙표 적용)를 허용한다 — migration 271과 같은 구조로 허용값과 set_tenant_theme() 목록만 늘린다.
-- 코드(tenant-theme-form.tsx·platform-admin/actions.ts)에는 이미 선택지가 있는데 DB 허용값이 없어 저장이 거부되던 것을 바로잡는다.
-- 기본값은 classic-light 그대로라 기존 회사 화면은 바뀌지 않는다.
alter table public.tenants
  drop constraint if exists tenants_theme_check;

alter table public.tenants
  add constraint tenants_theme_check check (theme in ('classic-light', 'grid-modern', 'grid-modern2'));

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
  if p_theme not in ('classic-light', 'grid-modern', 'grid-modern2') then
    raise exception '알 수 없는 테마입니다.';
  end if;
  update public.tenants set theme = p_theme where id = p_tenant_id;
end;
$$;

revoke all on function public.set_tenant_theme(uuid, text) from public;
grant execute on function public.set_tenant_theme(uuid, text) to authenticated;
