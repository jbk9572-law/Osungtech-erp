-- migration 223 주석에서 예고했던 "테마 C" — 사용자가 전달한 슬레이트
-- (회색)+블루 액센트+앰버 경고색 목업(그누보드류 넓고 촘촘한 장부
-- 느낌)을 네 번째 테마 후보 "classic-c"로 같은 토글 메커니즘(migration
-- 215)에 추가한다. 값 하나만 늘리는 변경이라 215의 나머지 구조는
-- 그대로 둔다.
alter table public.tenants
  drop constraint if exists tenants_theme_check;
alter table public.tenants
  add constraint tenants_theme_check check (theme in ('classic-light', 'modern', 'classic-b', 'classic-c'));

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
  if p_theme not in ('classic-light', 'modern', 'classic-b', 'classic-c') then
    raise exception '알 수 없는 테마입니다.';
  end if;
  update public.tenants set theme = p_theme where id = p_tenant_id;
end;
$$;

revoke all on function public.set_tenant_theme(uuid, text) from public;
grant execute on function public.set_tenant_theme(uuid, text) to authenticated;
