-- 플랫폼관리자 화면에 회사(테넌트) 삭제 기능이 아예 없었다(사용자 요청:
-- "관리자페이지에서 테넌트삭제키는 왜없는거야?"). 지금까지는
-- toggleTenantActive(로그인 차단)만 있었는데, 그건 "막아두기"일 뿐
-- 실제로 데이터를 정리하는 기능이 아니다.
--
-- 매우 파괴적인 작업(그 회사의 매출/매입/재고/거래처 등 전 데이터가
-- 영구 삭제됨)이라 안전장치를 겹겹이 둔다:
--   1) is_platform_admin()만 호출 가능(일반 테넌트 admin은 불가)
--   2) 플랫폼 운영 주체 테넌트(tenants.is_platform_operator)는 삭제 불가
--      — 이걸 지우면 모든 플랫폼 관리자 계정이 같이 날아간다.
--   3) 호출자 본인이 속한 테넌트도 삭제 불가(자기 자신을 지워 스스로
--      락아웃되는 사고 방지 — platform_admins 테이블로 등록된 관리자는
--      운영 주체가 아닌 다른 테넌트 소속일 수도 있어 2번만으로는
--      부족하다).
-- 화면 쪽(DeleteTenantForm)에서는 복원 작업과 같은 수준의 확인(임의
-- 4자리 코드 직접 입력)을 한 번 더 요구한다.
--
-- tenant_id를 가진 테이블은 전부 "references tenants(id) on delete
-- cascade"로 걸려 있어(migration 99부터 일관된 컨벤션), tenants 행
-- 하나만 지우면 그 회사의 모든 데이터가 함께 정리된다. 다만 auth.users는
-- public 스키마 밖이라 그 FK cascade 대상이 아니므로, 소속 계정은 여기서
-- 따로 지운다 — 안 지우면 "삭제된 회사"의 로그인 계정이 테넌트 없이
-- 영구히 남는다(current_tenant_id()가 null이 되어 이미 아무 데이터도
-- 못 보긴 하지만, 깔끔하게 정리하는 게 맞다).
create or replace function public.delete_tenant_hard(p_tenant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_operator boolean;
  v_name text;
  v_caller_tenant_id uuid;
begin
  if not public.is_platform_admin() then
    raise exception '플랫폼 운영자만 삭제할 수 있습니다.';
  end if;

  select is_platform_operator, name into v_is_operator, v_name
  from public.tenants where id = p_tenant_id;

  if v_name is null then
    raise exception '회사를 찾을 수 없습니다.';
  end if;
  if v_is_operator then
    raise exception '플랫폼 운영 주체 회사는 삭제할 수 없습니다.';
  end if;

  select tenant_id into v_caller_tenant_id from public.profiles where id = auth.uid();
  if v_caller_tenant_id = p_tenant_id then
    raise exception '본인이 속한 회사는 삭제할 수 없습니다.';
  end if;

  delete from auth.users
  where id in (select id from public.profiles where tenant_id = p_tenant_id);

  delete from public.tenants where id = p_tenant_id;
end;
$$;

revoke all on function public.delete_tenant_hard(uuid) from public;
grant execute on function public.delete_tenant_hard(uuid) to authenticated;
