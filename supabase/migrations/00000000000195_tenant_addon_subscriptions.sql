-- migration 194(add_on_products 카탈로그)의 TODO를 이어받는다 — "테넌트에
-- 애드온을 부착해 쿼터에 반영"하는 내부 기능. 결제(PG) 연동과는 별개로,
-- 관리자가 수동으로 부착/해제만 하면 바로 동작한다(tenant-addon-
-- panel.tsx에서 숫자를 손으로 조정하던 것과 같은 수준).
--
-- 실제 델타 계산(부착/해제 시 tenants.monthly_*_quota를 얼마나 올리고
-- 내릴지)은 이 테이블이 아니라 애플리케이션 서버 액션(platform-admin/
-- actions.ts의 attachTenantAddon/detachTenantAddon)에서 한다 — 이
-- 프로젝트는 updateTenantAddons(기존 수동 쿼터 조정)를 포함해 플랫폼
-- 관리자 쪽 쓰기 작업을 전부 SECURITY DEFINER RPC가 아니라 서버
-- 액션 + createAdminClient()(service_role) 조합으로 처리해왔다 —
-- 이번만 RPC로 바꿀 이유가 없어 같은 패턴을 따른다.
create table public.tenant_addon_subscriptions (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  add_on_product_id uuid not null references public.add_on_products (id) on delete restrict,
  -- 이 애드온 패키지를 몇 개 부착했는지(기획서 예시: "+100건" 패키지를
  -- 2개 부착하면 +200건). 부착 해제 없이 수량만 바꿀 수도 있어 서버
  -- 액션이 매번 "이전 수량 대비 델타"로 쿼터를 조정한다.
  quantity integer not null default 1 check (quantity > 0),
  attached_at timestamptz not null default now(),
  primary key (tenant_id, add_on_product_id)
);

alter table public.tenant_addon_subscriptions enable row level security;

-- 플랫폼 운영자만 다룬다 — 테넌트 자신에게 보여주는 "내 애드온" 화면은
-- 아직 없다(결제 연동과 함께 나중에 추가될 영역).
create policy "tenant_addon_subscriptions_platform_admin_only" on public.tenant_addon_subscriptions
  for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());
