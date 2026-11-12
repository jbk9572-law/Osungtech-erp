-- 테마를 classic-light(기본)와 soft(구 modern/classic-b/classic-c를
-- 하나로 합친 부드러운 테마) 두 가지로 정리한다. 지워지는 테마를 쓰던
-- 회사는 가장 가까운 soft로 옮긴다(기본 classic-light로 되돌리면 화면이
-- 갑자기 예전 모양이 되기 때문). 데이터는 theme 값만 바뀐다.
alter table public.tenants
  drop constraint if exists tenants_theme_check;

update public.tenants
  set theme = 'soft'
  where theme in ('modern', 'classic-b', 'classic-c');

alter table public.tenants
  add constraint tenants_theme_check check (theme in ('classic-light', 'soft'));

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
  if p_theme not in ('classic-light', 'soft') then
    raise exception '알 수 없는 테마입니다.';
  end if;
  update public.tenants set theme = p_theme where id = p_tenant_id;
end;
$$;

revoke all on function public.set_tenant_theme(uuid, text) from public;
grant execute on function public.set_tenant_theme(uuid, text) to authenticated;
