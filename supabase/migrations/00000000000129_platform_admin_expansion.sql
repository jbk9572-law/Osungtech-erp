-- 플랫폼 관리자 화면 확장(그누보드 관리자 수준으로 세분화 요청):
-- 1) platform_settings: 신규 테넌트 생성 시 적용할 기본값(기본 요금제/
--    기본으로 꺼둘 기능) — 싱글턴 행 하나만 존재한다.
-- 2) platform_announcements: 개별 테넌트 공지사항과 별개로, 플랫폼
--    전체 테넌트에 방송하는 공지(예: 점검 안내).
-- 3) get_cross_tenant_activity_log(): audit_logs는 테넌트별로 격리된
--    RESTRICTIVE 정책이 걸려 있어(migration 99) 플랫폼 운영자도 그냥은
--    남의 테넌트 로그를 못 본다. RESTRICTIVE 정책 자체를 손대면 기존
--    테넌트 격리 보장이 흔들릴 위험이 있어, 대신 SECURITY DEFINER
--    RPC로 "이 함수 안에서만" 우회한다(함수 자체가 is_platform_admin()을
--    검증).
-- 4) platform_plans: 요금제 카탈로그(이름/가격/설명) — tenants.plan은
--    지금처럼 계속 trial/active/suspended 상태값으로만 쓰고, 이건 별개로
--    "어떤 요금제 상품이 있는지"를 보여주는 참고용 목록이다.
-- 5) get_platform_stats(): 플랫폼 전체 테넌트/사용자 수 통계.

create table public.platform_settings (
  id boolean primary key default true check (id),
  default_plan text not null default 'trial',
  default_disabled_features text[] not null default '{}'::text[],
  updated_at timestamptz not null default now()
);

insert into public.platform_settings (id) values (true) on conflict (id) do nothing;

alter table public.platform_settings enable row level security;

create policy "platform_settings_platform_admin_only" on public.platform_settings
  for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- 배열 추가/제거를 읽고-고치고-쓰는 방식 대신 원자적으로 처리한다
-- (migration 104의 set_tenant_feature_enabled()와 동일한 이유 —
-- 플랫폼 운영자가 둘 이상이어도 동시 토글 시 유실되지 않는다).
create or replace function public.set_platform_default_feature_enabled(
  p_feature_key text,
  p_enabled boolean
)
returns void
language plpgsql
as $$
begin
  if not public.is_platform_admin() then
    raise exception '플랫폼 운영자만 변경할 수 있습니다.';
  end if;

  if p_enabled then
    update public.platform_settings
    set default_disabled_features = array_remove(default_disabled_features, p_feature_key),
        updated_at = now()
    where id = true;
  else
    update public.platform_settings
    set default_disabled_features = array_append(default_disabled_features, p_feature_key),
        updated_at = now()
    where id = true and not (p_feature_key = any(default_disabled_features));
  end if;
end;
$$;

revoke all on function public.set_platform_default_feature_enabled(text, boolean) from public;
grant execute on function public.set_platform_default_feature_enabled(text, boolean) to authenticated;

-- 신규 테넌트 생성 시 platform_settings의 기본값(기본 요금제/기본으로
-- 꺼둘 기능)을 적용한다. 이 함수는 SECURITY DEFINER라 platform_settings의
-- RLS(플랫폼 운영자 전용)와 무관하게 항상 읽을 수 있다. 행이 없는
-- 극단적인 경우에도 coalesce로 안전한 기본값(trial/빈 배열)으로
-- 떨어져 신규 가입 자체가 막히지 않는다.
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
  v_default_plan text;
  v_default_disabled_features text[];
begin
  v_tenant_id := nullif(new.raw_user_meta_data ->> 'tenant_id', '')::uuid;
  v_new_tenant_name := nullif(new.raw_user_meta_data ->> 'new_tenant_name', '');
  v_new_tenant_slug := nullif(new.raw_user_meta_data ->> 'new_tenant_slug', '');

  if v_tenant_id is null and v_new_tenant_name is not null then
    select default_plan, default_disabled_features
      into v_default_plan, v_default_disabled_features
      from public.platform_settings limit 1;

    insert into public.tenants (name, slug, plan, disabled_features)
    values (
      v_new_tenant_name,
      v_new_tenant_slug,
      coalesce(v_default_plan, 'trial'),
      coalesce(v_default_disabled_features, '{}'::text[])
    )
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
  end if;

  return new;
end;
$$;

create table public.platform_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text,
  is_active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.platform_announcements enable row level security;

-- 조회는 로그인한 사람이면 누구나(어느 테넌트든) — 대시보드 상단
-- 배너에 그대로 보여줄 내용이라 테넌트 격리 대상이 아니다.
create policy "platform_announcements_select_authenticated" on public.platform_announcements
  for select using (auth.role() = 'authenticated');

create policy "platform_announcements_write_platform_admin" on public.platform_announcements
  for insert with check (public.is_platform_admin());
create policy "platform_announcements_update_platform_admin" on public.platform_announcements
  for update using (public.is_platform_admin());
create policy "platform_announcements_delete_platform_admin" on public.platform_announcements
  for delete using (public.is_platform_admin());

create table public.platform_plans (
  id uuid primary key default gen_random_uuid(),
  plan_key text not null unique,
  name text not null,
  monthly_price integer not null default 0,
  description text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.platform_plans enable row level security;

create policy "platform_plans_platform_admin_only" on public.platform_plans
  for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- 테넌트별로 격리된 audit_logs/profiles를 플랫폼 운영자가 회사 구분
-- 없이 최근 N건 훑어보는 용도. SECURITY DEFINER로 RLS를 우회하되,
-- 함수 시작부에서 is_platform_admin()이 아니면 즉시 막는다 — 일반
-- 사용자가 우연히 이 함수를 호출해도 아무것도 못 본다.
create or replace function public.get_cross_tenant_activity_log(p_limit integer default 200)
returns table (
  id uuid,
  tenant_name text,
  table_name text,
  action text,
  actor_name text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception '플랫폼 운영자만 조회할 수 있습니다.';
  end if;

  return query
    select al.id, t.name as tenant_name, al.table_name, al.action,
           p.full_name as actor_name, al.created_at
    from public.audit_logs al
    left join public.tenants t on t.id = al.tenant_id
    left join public.profiles p on p.id = al.actor
    where al.is_demo = false
    order by al.created_at desc
    limit p_limit;
end;
$$;

revoke all on function public.get_cross_tenant_activity_log(integer) from public;
grant execute on function public.get_cross_tenant_activity_log(integer) to authenticated;

-- 플랫폼 전체 통계 — 테넌트 수/활성 테넌트 수/전체 사용자 수, 최근
-- 12개월 신규 테넌트 가입 추이.
create or replace function public.get_platform_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.is_platform_admin() then
    raise exception '플랫폼 운영자만 조회할 수 있습니다.';
  end if;

  select jsonb_build_object(
    'totalTenants', (select count(*) from public.tenants),
    'activeTenants', (
      select count(*) from public.tenants
      where disabled_at is null and (plan_expires_at is null or plan_expires_at > now())
    ),
    'totalUsers', (select count(*) from public.profiles where is_demo = false),
    'monthlySignups', (
      select coalesce(jsonb_agg(row_to_json(m)), '[]'::jsonb) from (
        select to_char(date_trunc('month', created_at), 'YYYY-MM') as month, count(*) as count
        from public.tenants
        where created_at > now() - interval '12 months'
        group by 1
        order by 1
      ) m
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_platform_stats() from public;
grant execute on function public.get_platform_stats() to authenticated;
