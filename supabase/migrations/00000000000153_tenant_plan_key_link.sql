-- 구독-요금제 미연동 — 전체 감사에서 발견한 2가지 문제.
--
-- 1) platform_plans 테이블에 "platform_plans_platform_admin_only" 정책
--    (for all, is_platform_admin() 조건) 하나만 있고, 일반 테넌트
--    사용자가 읽을 수 있는 select 정책이 아예 없었다. 그 결과
--    settings/billing 화면(테넌트 자신의 구독/결제 화면)의 "요금제 안내"
--    목록이 실제 고객에게는 RLS에 막혀 항상 빈 목록으로만 보였다 —
--    화면은 만들어져 있지만 실제로는 아무도 요금제 카탈로그를 볼 수
--    없던 상태.
-- 2) tenants ↔ platform_plans를 잇는 컬럼이 아예 없어서(migration 129
--    설계 당시 의도적으로 분리 — "tenants.plan은 상태값, platform_plans는
--    카탈로그"), 설사 위 1번을 고쳐 카탈로그가 보이더라도 "이 중에 지금
--    뭘 쓰고 있는지"는 구조적으로 표시할 수 없었다.
--
-- 활성 요금제는 일반 인증 사용자도 볼 수 있게 열고, tenants.plan_key로
-- 실제 구독 상품을 연결한다(플랫폼 운영자가 고객사 상세 화면에서 설정).
create policy "platform_plans_select_active" on public.platform_plans
  for select using (is_active = true and auth.role() = 'authenticated');

alter table public.tenants add column if not exists plan_key text references public.platform_plans (plan_key) on delete set null;
