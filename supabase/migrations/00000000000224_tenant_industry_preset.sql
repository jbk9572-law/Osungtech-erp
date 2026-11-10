-- 업종별 기능 템플릿(프리셋) — 사용자 요청: 신규 고객사를 받을 때마다
-- 플랫폼 관리자가 [환경설정 > 기능 관리]의 10여 개 토글을 하나하나
-- 손으로 꺼줘야 하던 걸, "업종" 하나만 골라서 일괄 적용할 수 있게
-- 한다. set_tenant_theme()(migration 215)와 완전히 같은 설계: 플랫폼
-- 관리자만 바꿀 수 있고, 적용은 그 테넌트의 disabled_features 배열을
-- 한 번에 갱신하는 것뿐이라 "잠그는" 게 아니다 — 적용 후에도 그 회사
-- 관리자는 환경설정 > 기능 관리에서 개별 항목을 자유롭게 다시 켜고 끌
-- 수 있다(테넌트 관리자의 기존 자유도를 전혀 건드리지 않음).
--
-- 프리셋 자체(어느 업종이 어떤 featureKey를 끄는지)는 DB에 새 테이블로
-- 만들지 않고 코드(src/lib/erp-menu.ts의 INDUSTRY_PRESETS)로 관리한다
-- — erp-menu.ts가 이미 BEHAVIOR_FEATURE_KEYS 같은 카탈로그를 코드로
-- 관리하는 기존 패턴과 같다. DB에는 "지금 이 테넌트가 어떤 프리셋을
-- 선택했는지"만 기록해 화면에 표시한다.
alter table public.tenants
  add column if not exists industry text;

-- get_platform_tenant_list()(migration 199, 215에서 theme 추가)에
-- industry/disabled_features를 추가한다 — 플랫폼관리자 > 환경설정의
-- 업종 템플릿 폼이 "그 회사 지금 업종이 뭔지, 지금 뭐가 꺼져 있는지"를
-- 같이 보여주고 골라야 한다. RETURNS TABLE 컬럼 구성을 바꾸므로
-- migration 215와 같은 이유로 먼저 DROP이 필요하다.
drop function if exists public.get_platform_tenant_list();
create function public.get_platform_tenant_list()
returns table (
  id uuid,
  name text,
  slug text,
  created_at timestamptz,
  disabled_at timestamptz,
  plan text,
  plan_expires_at timestamptz,
  theme text,
  industry text,
  disabled_features text[]
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
    select
      t.id, t.name, t.slug, t.created_at, t.disabled_at, t.plan, t.plan_expires_at, t.theme,
      t.industry, coalesce(t.disabled_features, '{}'::text[])
    from public.tenants t
    order by t.created_at asc
    limit 1000;
end;
$$;

revoke all on function public.get_platform_tenant_list() from public;
grant execute on function public.get_platform_tenant_list() to authenticated;

-- 업종 프리셋 일괄 적용 — p_disable/p_enable에 담긴 featureKey/href를
-- disabled_features 배열에서 한 번에 더하고 뺀다(set_tenant_feature_
-- enabled()처럼 배열 연산을 원자적으로 하되, 여러 키를 한 트랜잭션
-- 안에서 처리). p_industry는 화면 표시용 기록일 뿐 로직에 영향 없다.
create or replace function public.apply_tenant_feature_preset(
  p_tenant_id uuid,
  p_industry text,
  p_disable text[],
  p_enable text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception '플랫폼 운영자만 적용할 수 있습니다.';
  end if;

  update public.tenants
  set
    industry = p_industry,
    disabled_features = (
      select coalesce(array_agg(distinct k), '{}'::text[])
      from unnest(coalesce(disabled_features, '{}'::text[]) || coalesce(p_disable, '{}'::text[])) as k
      where not (k = any(coalesce(p_enable, '{}'::text[])))
    )
  where id = p_tenant_id;

  if not found then
    raise exception '회사를 찾을 수 없습니다.';
  end if;
end;
$$;

revoke all on function public.apply_tenant_feature_preset(uuid, text, text[], text[]) from public;
grant execute on function public.apply_tenant_feature_preset(uuid, text, text[], text[]) to authenticated;
