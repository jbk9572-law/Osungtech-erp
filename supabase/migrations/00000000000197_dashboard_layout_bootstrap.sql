-- (dashboard)/layout.tsx는 메뉴를 옮길 때마다(모달 열기 포함) 회사정보/
-- 내프로필/테넌트 기능설정/플랫폼관리자여부/전체공지/점검모드/부서별
-- 접근권한/쿼터 8개를 Promise.all로 "동시에" 조회하는데, 동시라도 결국
-- Cloudflare Workers에서 Supabase REST로 나가는 네트워크 요청이 8번
-- 따로 나간다. 거래량이 적어(하루 매출+매입 합쳐 10건 안팎) Workers
-- 인스턴스가 자주 새로 뜨는 편이라 ttlCached(프로세스 내 캐시)도 자주
-- 비어 있는 채로 시작하고, 그러면 메뉴 이동마다 8번의 왕복이 거의 매번
-- 그대로 발생해 체감 속도가 많이 느리다(사용자 지적).
--
-- 이 8개를 하나의 SQL 함수로 묶어서 왕복을 1번으로 줄인다. 각 서브쿼리는
-- 기존 (dashboard)/layout.tsx가 날리던 쿼리와 완전히 동일하게 그대로
-- 옮겨왔다 — SECURITY DEFINER를 쓰지 않고(기본값인 INVOKER 그대로) 호출한
-- 사용자 권한으로 그대로 실행되므로, 기존에 각 테이블에 걸려 있던 RLS
-- (테넌트 격리/데모 격리/플랫폼 운영자 전용 등)가 각 서브쿼리마다 똑같이
-- 그대로 적용된다 — 격리 로직을 이 함수 안에서 새로 손으로 다시 구현하지
-- 않는다(그랬다간 실수로 테넌트 경계를 잘못 긋는 사고가 날 수 있다).
--
-- 다만 tenants 서브쿼리 하나는 명시적으로 current_tenant_id()로 필터를
-- 추가했다 — tenants_select_platform_admin 정책(migration 121) 때문에
-- 플랫폼 운영자 계정은 RLS만으로는 전체 테넌트 행이 다 보여서(permissive
-- OR), 필터 없이 "아무 1행"을 집으면 자기 테넌트가 아닌 엉뚱한 테넌트의
-- disabled_features를 가져올 수 있었다(기존 .maybeSingle() 코드에선 이
-- 경우 여러 행 에러로 조용히 null로 빠지던 잠재 버그 — 이번에 고치면서
-- 같이 바로잡는다).
-- 키 이름을 전부 기존 각 쿼리가 돌려주던 컬럼명(snake_case) 그대로
-- 둔다 — layout.tsx/quotaStatusFromRpcRow 등 기존 소비 코드가 기대하는
-- 필드명과 똑같이 맞춰서, 쿼리를 하나로 합치는 것 외에 다른 변환 로직을
-- 추가로 만들 필요가 없게 한다.
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
      select jsonb_build_object('disabled_features', coalesce(disabled_features, '{}'::text[]))
      from public.tenants
      where id = public.current_tenant_id()
    ),
    'is_platform_admin', public.is_platform_admin(),
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

revoke all on function public.get_dashboard_layout_bootstrap() from public;
grant execute on function public.get_dashboard_layout_bootstrap() to authenticated;
