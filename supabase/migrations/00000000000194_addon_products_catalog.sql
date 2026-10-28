-- "애드온(추가 패키지) 상품 관리" — 기획서("엘보닉스 플랫폼 관리자 요금제
-- 및 동적 애드온 관리 구조", 2026-10-28)의 3번 항목.
--
-- 같은 기획서의 더 이른 버전(2026-10-27)이 제안한 plans/tenant_
-- subscriptions 분리 구조는 migration 189에서 "실제 결제(PG) 연동이
-- 붙는 시점에 추가하는 게 맞다"며 보류했었다 — 지금도 결제 연동은
-- 없다. 그런데 이번엔 "결제 연동은 나중에, 일단 관리자페이지에
-- 구현부터 해놓자"는 요청이라 결론이 다르다: 애드온을 실제 테넌트에
-- 붙여서 쿼터에 자동 반영하는 쪽(결제/정산과 맞물리는 부분)은 여전히
-- 보류하고, "관리자가 애드온 상품 종류를 코드 수정 없이 등록/수정"
-- 하는 카탈로그 관리 화면만 이번에 만든다 — platform_plans(요금제
-- 카탈로그)와 완전히 같은 선상의 "또 다른 카탈로그"일 뿐이라 migration
-- 129의 platform_plans 패턴(테이블+RLS)을 그대로 따른다.
--
-- TODO(다음 단계, 외부 API 불필요한 순수 내부 작업 — src/components/
-- tenant-addon-panel.tsx의 TODO와 동일 건): 테넌트에 실제로 애드온을
-- 붙여 쿼터에 자동 합산하는 기능은 이 테이블을 FK로 참조할
-- "tenant_addon_subscriptions"(tenant_id, add_on_product_id, quantity)
-- 테이블이 필요한 다음 단계 작업이다 — 지금은 안 만든다. 이건 결제(PG)
-- 연동과는 별개다: 관리자가 수동으로 부착/해제만 해도(지금
-- tenant-addon-panel.tsx에서 숫자를 손으로 조정하는 것과 똑같은
-- 수준으로) 바로 가능한 내부 기능이고, 실제 돈을 받는 결제 연동은 또
-- 그 다음 단계다.
create table public.add_on_products (
  id uuid primary key default gen_random_uuid(),
  -- 영문 ID(기획서 예시: addon_fax_100) — platform_plans.plan_key와 같은
  -- 역할, 사람이 코드/로그에서 바로 알아볼 수 있는 고유 식별자.
  key text not null unique,
  name text not null,
  -- 이 애드온이 어떤 쿼터를 늘리는지. 체크 제약으로 5종류를 고정한다 —
  -- 테넌트 쪽에 이미 있는 쿼터 컬럼(monthly_fax_quota/monthly_tax_
  -- invoice_quota/monthly_alimtalk_quota/vendor_limit)과 1:1로 대응되는
  -- 종류만 있어야 나중에 "테넌트에 적용" 기능을 코드 몇 줄로 연결할 수
  -- 있다 — 새 kind를 추가하려면 그 쪽 적용 로직도 같이 필요하므로, 이
  -- 체크 제약은 "값 하나 더 등록"이 아니라 실제 기능 추가와 함께
  -- 바뀌어야 한다(기획서의 "소스 코드 수정 없이" 범위는 같은 kind의
  -- 새 상품을 등록하는 것까지다).
  kind text not null check (kind in ('fax', 'invoice', 'alimtalk', 'vendor', 'storage')),
  -- 제공 용량/건수 — kind가 storage면 GB, 나머지는 건/개.
  capacity integer not null check (capacity > 0),
  monthly_price integer not null default 0 check (monthly_price >= 0),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.add_on_products enable row level security;

create policy "add_on_products_platform_admin_only" on public.add_on_products
  for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());
