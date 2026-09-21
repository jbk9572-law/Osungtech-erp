-- 타 업체(테넌트 #2 이상) 온보딩의 첫 단계.
--
-- 지금까지 handle_new_user()는 새 계정이 생기면 무조건 '오성테크'
-- 테넌트로 편입시켰다(migration 099) — 오성테크가 유일한 테넌트였을
-- 때는 맞는 동작이었지만, 이제 오성테크는 여러 회사 중 "테넌트 #1"일
-- 뿐이라 이 하드코딩을 걷어내야 한다.
--
-- 이 앱엔 공개 회원가입 페이지가 없다(모든 계정은 관리자가
-- auth.admin.createUser로 직접 만들어준다) — 그래서 "새 테넌트를
-- 만들지, 기존 테넌트에 합류시킬지"를 회원가입 폼이 아니라
-- auth.admin.createUser() 호출 시 넘기는 user_metadata로 판단하게
-- 바꾼다:
--   - tenant_id: 기존 테넌트에 합류(같은 회사에 새 직원 추가할 때)
--   - new_tenant_name + new_tenant_slug: 새 테넌트를 만들면서 합류
--     (플랫폼 운영자가 신규 고객사를 추가할 때)
-- 둘 다 없으면 예전처럼 조용히 오성테크로 새는 대신 에러를 내서
-- 막는다(fail-closed) — 이 버그가 처음 발견됐던 경위 자체가
-- "조용히 잘못된 곳으로 새는" 문제였기 때문에, 같은 실수를 반복하지
-- 않도록 앞으로 생기는 계정 생성 경로는 전부 이 두 값 중 하나를
-- 명시하도록 강제한다.

-- 1) tenants.slug — 로그인용 합성 이메일 도메인과, 나중에 서브도메인/
--    경로 기반 라우팅에 쓸 영문 식별자.
alter table public.tenants add column if not exists slug text;

update public.tenants set slug = 'osungtech' where name = '오성테크' and slug is null;

alter table public.tenants alter column slug set not null;

create unique index if not exists tenants_slug_unique on public.tenants (slug);

-- 2) 플랫폼(엘보닉스) 운영자 — 테넌트에 속하지 않는 별도 권한.
--    profiles.role의 admin은 테넌트 안에서만 의미 있는 값이라(RLS로
--    테넌트별로 격리됨), 여러 회사를 넘나드는 "고객사 추가" 화면의
--    권한 체크로는 쓸 수 없다.
create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;
-- 일반 사용자에게 열어줄 이유가 없다 — is_platform_admin()이 security
-- definer로 우회해서 읽으므로 별도 select 정책이 없어도 동작한다.

create or replace function public.is_platform_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;

revoke all on function public.is_platform_admin() from public;
grant execute on function public.is_platform_admin() to authenticated;

-- 플랫폼 운영자는 모든 회사 목록을 볼 수 있어야 "고객사 추가" 화면에
-- 전체 목록을 보여줄 수 있다. tenants_select_own(자기 테넌트만)과는
-- 별개의 permissive 정책이라 OR로 겹쳐진다 — 즉 "내 테넌트이거나,
-- 내가 플랫폼 운영자이거나" 둘 중 하나면 보인다.
drop policy if exists "tenants_select_platform_admin" on public.tenants;
create policy "tenants_select_platform_admin" on public.tenants
  for select using (public.is_platform_admin());

-- 3) handle_new_user() 재작성 — 하드코딩된 오성테크 대신
--    user_metadata를 보고 기존 테넌트 합류/신규 테넌트 생성을 가른다.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_new_tenant_name text;
  v_new_tenant_slug text;
begin
  v_tenant_id := nullif(new.raw_user_meta_data ->> 'tenant_id', '')::uuid;
  v_new_tenant_name := nullif(new.raw_user_meta_data ->> 'new_tenant_name', '');
  v_new_tenant_slug := nullif(new.raw_user_meta_data ->> 'new_tenant_slug', '');

  if v_tenant_id is null and v_new_tenant_name is not null then
    insert into public.tenants (name, slug)
    values (v_new_tenant_name, v_new_tenant_slug)
    returning id into v_tenant_id;
  end if;

  if v_tenant_id is null then
    raise exception
      '계정 생성 시 user_metadata에 tenant_id(기존 테넌트 합류) 또는 new_tenant_name+new_tenant_slug(신규 테넌트 생성)가 반드시 필요합니다.';
  end if;

  insert into public.tenant_members (tenant_id, user_id)
  values (v_tenant_id, new.id)
  on conflict (user_id) do nothing;

  insert into public.profiles (id, full_name, email, username, tenant_id)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.email,
    new.raw_user_meta_data ->> 'username',
    v_tenant_id
  );
  return new;
end;
$$;

-- 4) 첫 플랫폼 운영자 등록.
--    주의: 이 앱 로그인은 아이디 기반이라 실제 auth 이메일은
--    "아이디@osungtech.local" 형식이지, 개인 지메일 주소가 아니다.
--    아래 '여기에_본인_관리자_아이디' 자리에 /settings/users에서 쓰는
--    실제 로그인 아이디를 넣고 실행하세요.
insert into public.platform_admins (user_id)
select id from public.profiles where username = '여기에_본인_관리자_아이디'
on conflict (user_id) do nothing;
