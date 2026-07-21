-- 아이디(사용자명) 로그인 지원 + 관리자 계정 생성/권한 관리 기능.
-- 지금까지는 이메일로만 로그인했는데, "admin" 같은 단순 아이디로도 로그인할
-- 수 있게 하고, 관리자가 새 계정을 만들고 역할(권한)을 지정할 수 있게 한다.

create extension if not exists pgcrypto with schema extensions;

alter table public.profiles
  add column if not exists username text unique,
  add column if not exists email text;

-- 기존 계정들의 email을 auth.users에서 한 번 채워 넣는다(백필). 이후 신규
-- 가입자는 handle_new_user 트리거가 채운다.
update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id and p.email is null;

-- 신규 가입 시 full_name뿐 아니라 email/username도 같이 채우도록 트리거
-- 함수를 갱신한다. 회원가입 폼에서 username을 안 넣으면 null로 남고(로그인은
-- 계속 이메일로 가능), 관리자가 계정을 만들 때는 username을 지정한다.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, username)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.email,
    new.raw_user_meta_data ->> 'username'
  );
  return new;
end;
$$;

-- 로그인 화면에서 "아이디"를 입력했을 때(이메일 형식이 아닐 때) 실제 로그인에
-- 쓸 이메일을 찾기 위한 함수. 로그인 전(비로그인) 상태에서 호출되므로
-- profiles의 select 정책과 무관하게 동작해야 해서 security definer로 RLS를
-- 우회한다. 아이디→이메일 조회만 하고 비밀번호는 전혀 다루지 않으므로 안전하다.
create or replace function public.get_email_for_username(p_username text)
returns text
language sql
security definer set search_path = public
stable
as $$
  select email from public.profiles where username = p_username;
$$;

grant execute on function public.get_email_for_username(text) to anon, authenticated;

-- 관리자가 다른 사용자의 역할(role)을 변경할 수 있어야 계정별 권한 관리가
-- 가능하다. 기존엔 본인 프로필만 수정 가능했다(profiles_update_own).
drop policy if exists "profiles_update_by_admin" on public.profiles;
create policy "profiles_update_by_admin" on public.profiles
  for update using (
    exists (
      select 1 from public.profiles me
      where me.id = auth.uid() and me.role = 'admin'
    )
  );

-- 관리자 계정(아이디: admin / 비밀번호: admin)을 한 번만 시드한다. 이미
-- 만들어져 있으면(마이그레이션 재실행 시) 아무 것도 하지 않는다. 로그인 후
-- 비밀번호를 바로 바꾸는 것을 권장한다.
do $$
declare
  v_user_id uuid;
begin
  if not exists (select 1 from public.profiles where username = 'admin') then
    v_user_id := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token,
      email_change_token_new, email_change,
      email_change_token_current, reauthentication_token
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      'admin@osungtech.local',
      crypt('admin', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}',
      jsonb_build_object('full_name', '관리자', 'username', 'admin'),
      '', '', '', '', '', ''
    );

    -- on_auth_user_created 트리거가 이미 profiles 행을 만들었으니 role만
    -- admin으로 올린다.
    update public.profiles
    set role = 'admin'
    where id = v_user_id;
  end if;
end $$;
