-- SaaS 판매용 방향: 모든 테넌트(고객사)가 모든 기능을 다 쓰는 게
-- 아니므로, 관리자가 메뉴 단위로 기능을 켜고 끌 수 있게 한다.
--
-- tenants.disabled_features에 꺼진 기능의 키를 담아둔다(비어있으면
-- 전부 켜짐 = 기존과 동일한 동작, 오성테크 등 기존 테넌트는 아무것도
-- 안 꺼진 채로 시작). 어떤 메뉴 그룹이 어느 키에 해당하는지는 앱
-- 코드(erp-menu.ts의 featureKey)에서 관리 — DB는 "꺼진 키 목록"만
-- 들고 있어서, 나중에 토글 가능한 기능이 늘어나도(HR, 이메일 등)
-- 스키마 변경 없이 그대로 확장된다.
alter table public.tenants add column if not exists disabled_features text[] not null default '{}';

-- 지금까지는 select 정책만 있었다(migration 98) — 관리자가 자기
-- 테넌트의 기능 토글을 저장하려면 update가 필요하다. 일반 조회 정책과
-- 마찬가지로 "자기 테넌트"로 한정하고, 관리자만 되게 is_admin()도 같이
-- 건다.
create policy "tenants_update_admin" on public.tenants
  for update
  using (id = public.current_tenant_id() and public.is_admin())
  with check (id = public.current_tenant_id() and public.is_admin());

-- 배열 추가/제거를 읽고-고치고-쓰는 방식으로 하면(조회 후 별도 update)
-- 두 관리자가 동시에 다른 기능을 토글할 때 한쪽이 유실될 수 있다 —
-- SQL 배열 연산으로 한 번에 원자적으로 처리한다.
create or replace function public.set_tenant_feature_enabled(
  p_feature_key text,
  p_enabled boolean
)
returns void
language plpgsql
as $$
declare
  v_tenant_id uuid := public.current_tenant_id();
begin
  if v_tenant_id is null then
    raise exception '소속된 테넌트가 없습니다.';
  end if;
  if not public.is_admin() then
    raise exception '관리자만 기능을 켜고 끌 수 있습니다.';
  end if;

  if p_enabled then
    update public.tenants
    set disabled_features = array_remove(disabled_features, p_feature_key)
    where id = v_tenant_id;
  else
    update public.tenants
    set disabled_features = array_append(disabled_features, p_feature_key)
    where id = v_tenant_id and not (p_feature_key = any(disabled_features));
  end if;
end;
$$;

revoke all on function public.set_tenant_feature_enabled(text, boolean) from public;
grant execute on function public.set_tenant_feature_enabled(text, boolean) to authenticated;
