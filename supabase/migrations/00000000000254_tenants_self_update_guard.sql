-- 회사 관리자가 자기 회사 행(tenants)의 요금제·포인트·쿼터·플랫폼 운영자 표시 같은 컬럼을 직접 고칠 수 있던 구멍(보안 점검 결과).
--
-- 104 마이그레이션의 tenants_update_admin 정책은 "내 회사 + 관리자"면 행 전체 update 를 허용한다. 앱은 회사 관리자 화면에서
-- closing_date(마감일)와 disabled_features(기능 켜기/끄기)만 고치지만, 브라우저 개발자도구로 REST(PATCH /rest/v1/tenants)를 직접 부르면
-- points_balance, plan_key, plan_expires_at, 각종 quota, disabled_at, is_sandbox, is_platform_operator 까지 바꿀 수 있었다(요금제·포인트·쿼터 우회).
--
-- → 사용자(authenticated)가 직접 update 하는 경우에는 closing_date / disabled_features 외의 컬럼 변경을 거절한다.
--    - 플랫폼 운영자(is_platform_admin)는 예외.
--    - 서비스 롤(admin 클라이언트)과 security definer 함수(포인트 차감, 사용량 집계, 업종 템플릿 적용, 샌드박스 도구 등)는
--      current_user 가 'authenticated' 가 아니라서 이 검사를 받지 않는다(그래서 기존 기능은 그대로 동작한다).
create or replace function public.guard_tenant_self_update()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon') and not public.is_platform_admin() then
    if (to_jsonb(new) - 'closing_date' - 'disabled_features') is distinct from (to_jsonb(old) - 'closing_date' - 'disabled_features') then
      raise exception '회사 관리자가 직접 바꿀 수 없는 항목입니다. (마감일과 기능 켜기/끄기만 변경할 수 있습니다.)';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists tenants_guard_self_update on public.tenants;
create trigger tenants_guard_self_update
  before update on public.tenants
  for each row execute function public.guard_tenant_self_update();

-- 플랫폼 R2 사용량 집계 함수는 내부 인증 확인이 없어 비로그인(anon)도 호출할 수 있었다. 로그인 사용자 전용으로 한정한다.
revoke execute on function public.increment_platform_r2_class_a_ops(integer) from anon;
