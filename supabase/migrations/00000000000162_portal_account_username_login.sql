-- 거래처 포털 계정도 직원처럼 "아이디+비밀번호"로 로그인할 수 있게 한다
-- (지금까지는 Supabase Auth가 이메일 기반이라, 로그인 화면에 "@"가 없는
-- 문자열을 넣으면 무조건 "직원 계정"으로 보고 회사코드를 요구했다 — 포털
-- 계정은 이메일 형식이 아닌 아이디를 쓸 수 없었다).
--
-- customer_portal_accounts에 email을 더존처럼 비정규화해서 저장해둔다
-- (profiles.email과 같은 패턴 — get_email_for_username()이 profiles.email을
-- 바로 읽는 것처럼, 이것도 auth.users를 조인할 필요 없이 바로 읽는다).
alter table public.customer_portal_accounts
  add column if not exists email text;

-- 기존에 발급된 포털 계정(이 마이그레이션 적용 전)은 email이 비어 있으므로
-- auth.users에서 한 번만 채워 넣는다(마이그레이션 040의 profiles 백필과
-- 같은 방식) — 이후 신규 계정은 handle_new_user() 트리거가 채운다.
update public.customer_portal_accounts a
set email = u.email
from auth.users u
where a.user_id = u.id and a.email is null;

-- 아이디(username)로 이메일을 찾으려면 username이 전역에서 유일해야
-- 한다 — 지금까지는 username = email로만 발급돼서 자연히 유일했지만,
-- 이제 이메일 형식이 아닌 짧은 아이디도 허용하므로 제약으로 명시해
-- 보장한다.
drop index if exists customer_portal_accounts_username_unique_idx;
create unique index customer_portal_accounts_username_unique_idx
  on public.customer_portal_accounts (username);

-- handle_new_user(): 포털 계정 분기에 email 저장을 추가한다. 나머지는
-- 마이그레이션 161과 동일.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_new_tenant_name text;
  v_new_tenant_slug text;
  v_is_new_tenant boolean := false;
  v_portal_customer_id uuid;
begin
  v_portal_customer_id := nullif(new.raw_user_meta_data ->> 'portal_customer_id', '')::uuid;

  if v_portal_customer_id is not null then
    select tenant_id into v_tenant_id from public.customers where id = v_portal_customer_id;
    if v_tenant_id is null then
      raise exception '거래처를 찾을 수 없어 포털 계정을 만들 수 없습니다.';
    end if;

    insert into public.customer_portal_accounts (user_id, customer_id, username, tenant_id, email)
    values (
      new.id, v_portal_customer_id,
      coalesce(new.raw_user_meta_data ->> 'username', new.email),
      v_tenant_id,
      new.email
    );

    return new;
  end if;

  v_tenant_id := nullif(new.raw_user_meta_data ->> 'tenant_id', '')::uuid;
  v_new_tenant_name := nullif(new.raw_user_meta_data ->> 'new_tenant_name', '');
  v_new_tenant_slug := nullif(new.raw_user_meta_data ->> 'new_tenant_slug', '');

  if v_tenant_id is null and v_new_tenant_name is not null then
    insert into public.tenants (name, slug)
    values (v_new_tenant_name, v_new_tenant_slug)
    returning id into v_tenant_id;
    v_is_new_tenant := true;
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

  if v_is_new_tenant then
    insert into public.company_profile (tenant_id, name)
    values (v_tenant_id, v_new_tenant_name);

    insert into public.document_templates (tenant_id, category, name, body)
    select v_tenant_id, d.category, d.name, d.body
    from public.default_document_templates() d;
  end if;

  return new;
end;
$$;

-- 로그인 화면에서 "아이디"를 입력했을 때(이메일 형식이 아닐 때) 실제
-- 로그인에 쓸 이메일을 찾기 위한 함수 — get_email_for_username()의 포털
-- 버전. 같은 이유로(비로그인 상태에서 호출되고, anon에게 직접 주면 REST
-- API로 아이디 존재 여부를 무제한 조회당할 수 있어) service_role에게만
-- 실행 권한을 주고, src/app/login/actions.ts가 관리자 클라이언트로만
-- 호출한다.
create or replace function public.get_portal_email_for_username(p_username text)
returns text
language sql
security definer set search_path = public
stable
as $$
  select email from public.customer_portal_accounts where username = p_username and not disabled;
$$;

revoke all on function public.get_portal_email_for_username(text) from public, anon, authenticated;
grant execute on function public.get_portal_email_for_username(text) to service_role;
