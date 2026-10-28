-- 플랫폼 관리자 판정 방식 변경: "엘보닉스(테넌트 #1) 테넌트에서 관리자
-- 역할이면 자동으로 플랫폼 전체 관리자"가 되게 한다.
--
-- 지금까지는 platform_admins 테이블에 계정을 수동으로 한 명씩 등록해야만
-- 플랫폼 관리자가 됐다(migration 121) — 그런데 실제 운영 모델은
-- "엘보닉스가 테넌트 #1이고, 엘보닉스 테넌트 안에서 admin 역할인 사람이
-- 곧 플랫폼 전체 관리자"다. 이 둘이 안 맞아서, 엘보닉스 테넌트의 admin
-- 계정인데도 platform_admins 명단에 따로 없으면 플랫폼 관리자 화면에
-- 못 들어가는 문제가 생겼다(로그인 코드/비번은 멀쩡해도 "플랫폼
-- 관리자가 아님"으로 막히는 경우).
--
-- 그래서 is_platform_admin()을 "OR" 조건으로 넓힌다:
--   1) platform_admins 테이블에 등록돼 있거나 (기존 방식 — 엘보닉스
--      테넌트 소속이 아닌 사람을 플랫폼 운영진으로 넣어야 할 수도 있으니
--      그대로 남겨둔다, 하위 호환),
--   2) 또는 엘보닉스(테넌트 #1, slug='osungtech') 소속이면서
--      profiles.role = 'admin'이면.
-- 테넌트를 UUID로 하드코딩하지 않고 slug로 찾는다 — 이미 로그인 함수
-- (get_email_for_username, migration 134)도 같은 방식으로 테넌트 #1을
-- 가리킨다.
--
-- 보안적으로 이 변경이 뜻하는 것: 엘보닉스 테넌트 안에서 누군가를 admin
-- 역할로 올리면 그 즉시 플랫폼 전체(모든 고객사) 관리자 권한도 같이
-- 생긴다. 엘보닉스 테넌트의 admin 역할 부여 자체를 신중하게 다뤄야
-- 한다는 뜻이다.
create or replace function public.is_platform_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    exists (select 1 from public.platform_admins where user_id = auth.uid())
    or exists (
      select 1
      from public.profiles p
      join public.tenants t on t.id = p.tenant_id
      where p.id = auth.uid()
        and p.role = 'admin'
        and t.slug = 'osungtech'
    );
$$;

revoke all on function public.is_platform_admin() from public;
grant execute on function public.is_platform_admin() to authenticated;
