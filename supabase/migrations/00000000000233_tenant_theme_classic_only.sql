-- soft 테마(migration 232)를 없애고 classic-light 하나로 되돌린다.
-- 테마 컬럼/RPC 구조는 나중에 다른 테마를 다시 넣을 수 있게 그대로 둔다.
alter table public.tenants
  drop constraint if exists tenants_theme_check;

update public.tenants
  set theme = 'classic-light'
  where theme <> 'classic-light';

alter table public.tenants
  add constraint tenants_theme_check check (theme in ('classic-light'));

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
  if p_theme not in ('classic-light') then
    raise exception '알 수 없는 테마입니다.';
  end if;
  update public.tenants set theme = p_theme where id = p_tenant_id;
end;
$$;

revoke all on function public.set_tenant_theme(uuid, text) from public;
grant execute on function public.set_tenant_theme(uuid, text) to authenticated;
