-- 사용자 요청 — 상용화 전 디자인 후보를 실제로 토글해가며 비교하고
-- 싶다("가장 나은 디자인을 찾으려고", 이후 테마 C도 예고). 기존
-- "모던"(인디고 + 큰 라운드 코너)과는 다른 방향(인디고 + 각진 모서리,
-- 어두운 네이비 타이틀바)의 세 번째 테마 후보 "classic-b"를 같은
-- 토글 메커니즘(migration 215)에 추가한다. 값 하나만 늘리는 변경이라
-- 215의 나머지 구조(이 함수/제약이 참조하는 모든 것)는 그대로 둔다.
alter table public.tenants
  drop constraint if exists tenants_theme_check;
alter table public.tenants
  add constraint tenants_theme_check check (theme in ('classic-light', 'modern', 'classic-b'));

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
  if p_theme not in ('classic-light', 'modern', 'classic-b') then
    raise exception '알 수 없는 테마입니다.';
  end if;
  update public.tenants set theme = p_theme where id = p_tenant_id;
end;
$$;

revoke all on function public.set_tenant_theme(uuid, text) from public;
grant execute on function public.set_tenant_theme(uuid, text) to authenticated;
