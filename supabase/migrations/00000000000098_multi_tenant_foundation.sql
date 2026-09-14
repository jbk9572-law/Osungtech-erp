-- 멀티테넌트 전환 1단계: 테넌트 개념 자체를 추가한다.
--
-- 지금까지는 "회사 하나 = 서버 하나"였는데, 이 앱을 다른 회사에도 판매할
-- 수 있게 만들려면 여러 회사(테넌트)가 같은 DB를 공유하면서도 서로의
-- 데이터를 절대 볼 수 없어야 한다. migration 85(데모 계정 격리)에서 이미
-- 검증된 방식 그대로 재사용한다 — is_demo_actor() + RESTRICTIVE 정책으로
-- "실제 계정은 실제 데이터만" 격리했던 것과 완전히 같은 틀로,
-- current_tenant_id() + RESTRICTIVE 정책으로 "이 테넌트 계정은 이 테넌트
-- 데이터만" 격리한다. 실제 tenant_id 컬럼/정책 추가는 다음 마이그레이션
-- (099)에서 하고, 여기서는 그 기반(테넌트 테이블, 소속 테이블, 조회 함수)만
-- 만든다.
--
-- 오성테크의 기존 데이터는 하나도 지우거나 초기화하지 않는다 — 이
-- 마이그레이션이 끝나면 오성테크가 곧 "테넌트 #1"이 되고, 기존 계정/
-- 데이터는 전부 그대로 그 테넌트 소속으로 편입된다(099에서 백필).

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- MVP 단순화: 계정 1개 = 테넌트 1개(user_id에 unique). 여러 회사에
-- 동시 소속되는 경우는 지금 요구사항에 없고, 나중에 필요해지면
-- unique(user_id) 제약만 풀고 "현재 활성 테넌트 전환" UI를 얹으면 된다
-- — tenant_members 테이블 구조 자체는 그 확장을 그대로 수용한다.
create table if not exists public.tenant_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null unique references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists tenant_members_tenant_id_idx on public.tenant_members (tenant_id);

alter table public.tenants enable row level security;
alter table public.tenant_members enable row level security;

-- 자기 테넌트 행 / 자기 테넌트 소속 목록만 조회 가능. 생성/수정/삭제는
-- 지금 단계에서 API로 열어줄 필요가 없다(가입 트리거와 관리자 도구만
-- 다룬다) — 필요해지면 owner 역할 기준으로 정책을 추가하면 된다.
create policy "tenants_select_own" on public.tenants
  for select using (id = public.current_tenant_id());

create policy "tenant_members_select_own_tenant" on public.tenant_members
  for select using (tenant_id = public.current_tenant_id());

-- 지금 로그인한 사용자가 속한 테넌트 id. is_admin()/is_demo_actor()와
-- 완전히 같은 패턴(security definer + stable)이라 RLS 정책 안에서
-- 순환 참조 없이 안전하게 쓸 수 있다. 아직 어느 테넌트에도 속하지 않은
-- 계정(가입 직후 등)이면 null을 반환하고, 그러면 등호 비교(tenant_id =
-- current_tenant_id())가 항상 false가 되어 자동으로 접근이 막힌다
-- (fail-closed).
create or replace function public.current_tenant_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select tenant_id from public.tenant_members where user_id = auth.uid();
$$;

revoke all on function public.current_tenant_id() from public;
grant execute on function public.current_tenant_id() to authenticated;

-- 오성테크를 테넌트 #1로 만든다. 재실행해도 안전하도록 이미 있으면
-- 새로 만들지 않는다.
do $$
declare
  v_tenant_id uuid;
begin
  select id into v_tenant_id from public.tenants where name = '오성테크' limit 1;

  if v_tenant_id is null then
    insert into public.tenants (name) values ('오성테크') returning id into v_tenant_id;
  end if;

  -- 기존에 가입돼 있는 모든 계정(실제 + 데모 계정 전부)을 오성테크
  -- 소속으로 편입한다. 데모 계정도 "오성테크를 시연하는 계정"이라는
  -- 점은 그대로이므로 같은 테넌트 소속이 맞다 — 실제/데모 데이터 분리는
  -- 이미 있는 is_demo RESTRICTIVE 정책이 별도로 계속 담당한다(테넌트
  -- 정책과 AND로 합쳐진다).
  insert into public.tenant_members (tenant_id, user_id)
  select v_tenant_id, id from public.profiles
  on conflict (user_id) do nothing;
end $$;

-- 앞으로 새로 가입하는 계정을 자동으로 오성테크 소속에 편입시키는
-- handle_new_user() 갱신은 099에서 한다 — profiles.tenant_id 컬럼이
-- 아직 이 마이그레이션에는 없어서(099에서 추가) 여기서 먼저 바꾸면
-- 컬럼 없음 에러가 난다.
