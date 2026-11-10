-- 플랫폼 관리자가 "이 회사로 들어가기"로 특정 테넌트의 실제 화면을 그
-- 회사 직원처럼 볼 수 있게 한다. 사용자 요청: "플랫폼관리자는... 전체
-- 관리자니까 모든 업체를 드롭다운으로 바꿔가며 들어갈 수 있게 해줘야
-- 하는거아니야? 에러 확인요청 받으면 들어가서 확인해봐야 하니깐" —
-- 지금까지는 실패로그/고객지원/활동로그처럼 "플랫폼관리자용으로 따로
-- 집계한 화면"만 있었고, 그 회사가 실제로 보는 매출/거래처 같은 업무
-- 화면은 관리자가 직접 열어볼 방법이 없었다. 읽기전용으로 시작할지
-- 물었더니 "쓰기도 되게 해야 테스트로 뭘 등록해보지"라고 해서, 처음부터
-- 읽기/쓰기 모두 허용한다.
--
-- 구현 방식: current_tenant_id()(migration 98)가 tenant_members만 보고
-- 테넌트를 정하는데, 이 함수 하나가 모든 테이블의 RLS(격리 정책)와
-- 거의 모든 RPC의 기준점이다 — 그래서 "지금 이 관리자가 대신 보고 있는
-- 테넌트"가 있으면 그걸 최우선으로 돌려주도록 이 함수 하나만 바꾸면,
-- 기존 화면/RPC를 단 한 줄도 안 고치고 전체 앱이 자동으로 그 회사
-- 기준으로 동작한다(매출/거래처/재고 등 전부 포함).
create table if not exists public.platform_admin_impersonations (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

-- "지금 활성 상태인 가장(假裝) 세션"을 빠르게 찾기 위한 부분 인덱스 —
-- 관리자 1명당 활성(ended_at is null) 행은 최대 1개만 있어야 한다(start_
-- tenant_impersonation이 새로 시작할 때 기존 활성 행을 먼저 종료시킴).
create unique index if not exists platform_admin_impersonations_active_idx
  on public.platform_admin_impersonations (admin_user_id)
  where ended_at is null;

-- 이 테이블은 PostgREST로 직접 노출하지 않는다 — 시작/종료/조회 전부
-- SECURITY DEFINER RPC로만 하고, RLS는 활성화한 채 정책을 하나도 안
-- 둬서(기본값: 전부 거부) 일반 쿼리로는 아무도 못 보게 막는다.
alter table public.platform_admin_impersonations enable row level security;

create or replace function public.current_tenant_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select tenant_id from public.platform_admin_impersonations where admin_user_id = auth.uid() and ended_at is null),
    (select tenant_id from public.tenant_members where user_id = auth.uid())
  );
$$;

-- profiles_tenant_isolation(migration 99)은 RESTRICTIVE라 "tenant_id =
-- current_tenant_id()"를 못 만족하는 행은 무조건 가려진다 — 그런데
-- 관리자 자신의 profiles 행은 원래 소속 테넌트(홈 테넌트) 그대로라서,
-- 위에서 current_tenant_id()가 "들어가 있는" 테넌트를 돌려주기
-- 시작하면 관리자 자기 자신의 프로필조차 안 보이게 막혀버린다
-- (get_dashboard_layout_bootstrap의 "내 프로필" 조회 포함 — 이게
-- 깨지면 역할/부서를 못 읽어 메뉴/권한 판단이 전부 틀어진다). "자기
-- 자신의 행은 항상 보인다"는 예외를 SELECT/UPDATE 대상 판별(USING)에만
-- 추가한다 — WITH CHECK(쓰기 후 결과가 만족해야 하는 조건)는 그대로
-- 둬서, 들어가 있는 동안에는 자기 프로필을 고쳐 쓰는 것 자체는 막는다
-- (고치려면 먼저 나가야 함 — 실수로 다른 회사 컨텍스트에서 자기 계정을
-- 바꾸는 사고를 막기 위한 보수적 선택).
drop policy if exists "profiles_tenant_isolation" on public.profiles;
create policy "profiles_tenant_isolation" on public.profiles
  as restrictive
  for all
  using (tenant_id = public.current_tenant_id() or id = auth.uid())
  with check (tenant_id = public.current_tenant_id());

create or replace function public.start_tenant_impersonation(p_tenant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception '플랫폼 운영자만 다른 회사로 들어갈 수 있습니다.';
  end if;
  if not exists (select 1 from public.tenants where id = p_tenant_id) then
    raise exception '회사를 찾을 수 없습니다.';
  end if;

  -- 드롭다운으로 바로 다른 회사로 "바꿔가며" 들어갈 수 있어야 하므로,
  -- 이미 다른 회사에 들어가 있어도 먼저 나갈 필요 없이 바로 전환한다.
  update public.platform_admin_impersonations
  set ended_at = now()
  where admin_user_id = auth.uid() and ended_at is null;

  insert into public.platform_admin_impersonations (admin_user_id, tenant_id)
  values (auth.uid(), p_tenant_id);
end;
$$;

revoke all on function public.start_tenant_impersonation(uuid) from public;
grant execute on function public.start_tenant_impersonation(uuid) to authenticated;

create or replace function public.stop_tenant_impersonation()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.platform_admin_impersonations
  set ended_at = now()
  where admin_user_id = auth.uid() and ended_at is null;
end;
$$;

revoke all on function public.stop_tenant_impersonation() from public;
grant execute on function public.stop_tenant_impersonation() to authenticated;

-- (dashboard)/layout.tsx가 셸 전체에 "지금 OOO 회사를 대신 보는 중"
-- 배너를 띄우려면 지금 들어가 있는 테넌트 이름이 필요하다 — 기존 8개
-- 조회를 이미 하나로 묶어둔 get_dashboard_layout_bootstrap()(migration
-- 197)에 얹어서 왕복을 늘리지 않는다.
create or replace function public.get_dashboard_layout_bootstrap()
returns jsonb
language sql
set search_path = public
stable
as $$
  select jsonb_build_object(
    'company', (
      select jsonb_build_object('name', name, 'logo_mark_url', logo_mark_url)
      from public.company_profile
      limit 1
    ),
    'profile', (
      select jsonb_build_object('is_demo', is_demo, 'role', role, 'department_id', department_id)
      from public.profiles
      where id = auth.uid()
    ),
    'tenant', (
      select jsonb_build_object('disabled_features', coalesce(disabled_features, '{}'::text[]), 'theme', theme)
      from public.tenants
      where id = public.current_tenant_id()
    ),
    'is_platform_admin', public.is_platform_admin(),
    'impersonation', (
      select jsonb_build_object('tenant_name', t.name)
      from public.platform_admin_impersonations pai
      join public.tenants t on t.id = pai.tenant_id
      where pai.admin_user_id = auth.uid() and pai.ended_at is null
    ),
    'announcements', (
      select coalesce(jsonb_agg(jsonb_build_object('id', id, 'title', title)), '[]'::jsonb)
      from (
        select id, title
        from public.platform_announcements
        where is_active = true
        order by created_at desc
        limit 20
      ) a
    ),
    'platform_settings', (
      select jsonb_build_object('maintenance_mode', maintenance_mode, 'maintenance_message', maintenance_message)
      from public.platform_settings
      where id = true
    ),
    'department_page_access', (
      select coalesce(jsonb_agg(jsonb_build_object('page_key', page_key, 'department_id', department_id)), '[]'::jsonb)
      from public.department_page_access
    ),
    'quota', (
      select jsonb_build_object(
        'db_bytes_used', db_bytes_used,
        'db_quota_bytes', db_quota_bytes,
        'db_pct', db_pct,
        'file_bytes_used', file_bytes_used,
        'file_quota_bytes', file_quota_bytes,
        'file_pct', file_pct
      )
      from public.get_tenant_quota_status()
    )
  );
$$;
