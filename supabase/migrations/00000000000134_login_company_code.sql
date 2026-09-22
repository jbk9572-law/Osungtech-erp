-- 로그인 화면에 "회사코드"를 추가해, 아이디가 테넌트 전역이 아니라
-- 회사(테넌트)별로만 유니크하면 되게 바꾼다.
--
-- 지금까지 profiles.username은 테넌트 구분 없이 전역으로 unique였다
-- (migration 040) — 그래서 두 회사가 똑같이 "admin"이라는 아이디를
-- 쓰려고 하면 두 번째 회사는 가입 자체가 막혔다(실제로
-- platform-admin/actions.ts의 createCompanyTenant가 "이미 다른 회사에서
-- 사용 중인 아이디입니다"라고 미리 막고 있었다). 로그인용 실제 이메일은
-- 이미 "아이디@회사슬러그.elvonix.local" 형식이라 회사마다 자동으로
-- 갈리는데, profiles.username 자체의 전역 unique 제약 하나 때문에 그
-- 장점을 못 쓰고 있었다.

-- 1) 전역 unique를 (tenant_id, username) 조합 unique로 바꾼다. 지금까지
--    전역으로 유니크했으니 이 조합도 당연히 유니크해서 데이터 손실 없이
--    안전하게 바꿀 수 있다.
alter table public.profiles drop constraint if exists profiles_username_key;
create unique index if not exists profiles_tenant_id_username_unique
  on public.profiles (tenant_id, username);

-- 2) 로그인 전(비로그인) 상태에서 호출되는 두 함수 모두 이제 회사코드
--    (tenants.slug)를 같이 받아서, 같은 아이디가 여러 회사에 있어도
--    정확히 그 회사의 계정만 찾는다. 기존 단일 인자 버전은 이제 어느
--    회사인지 알 수 없어 아예 위험하므로 지운다.
drop function if exists public.get_email_for_username(text);
drop function if exists public.get_login_block_reason(text);
drop function if exists public.is_login_tenant_disabled(text);

create or replace function public.get_email_for_username(p_slug text, p_username text)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select p.email
  from public.profiles p
  join public.tenants t on t.id = p.tenant_id
  where t.slug = p_slug and p.username = p_username;
$$;

-- get_email_for_username은 로그인 전(비로그인) 상태에서 호출되지만, anon에게
-- 직접 실행 권한을 주면 공개된 anon key만으로 REST API를 두드려 아이디
-- 존재 여부/이메일을 무제한 조회(계정 목록 수집)할 수 있다(migration 075
-- 참고) — 그래서 service_role에게만 권한을 주고, 서버 액션(로그인)이
-- 관리자 클라이언트로만 호출한다.
revoke all on function public.get_email_for_username(text, text) from public, anon, authenticated;
grant execute on function public.get_email_for_username(text, text) to service_role;

create or replace function public.get_login_block_reason(p_slug text, p_username text)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select case
    when t.disabled_at is not null then 'disabled'
    when t.plan_expires_at is not null and t.plan_expires_at < now() then 'expired'
    else null
  end
  from public.profiles p
  join public.tenants t on t.id = p.tenant_id
  where t.slug = p_slug and p.username = p_username;
$$;

revoke all on function public.get_login_block_reason(text, text) from public, anon, authenticated;
grant execute on function public.get_login_block_reason(text, text) to service_role;
