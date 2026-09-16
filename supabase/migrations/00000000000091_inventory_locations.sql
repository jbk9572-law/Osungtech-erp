-- 재고 실사를 "품목마다 QR"이 아니라 "보관 위치(랙-단-좌우)마다 QR
-- 1개"로 하기 위한 스키마. QR에는 위치 코드(예: A-01-01)만 담기고,
-- 그 위치를 스캔하면 지금 그 자리에 있는 품목/수량을 조회한다 — 품목이나
-- 수량이 바뀌어도 QR 자체는 위치에 고정이라 다시 인쇄할 필요가 없다.
--
-- 기존 inventory(품목-창고 단위 합계)는 매출/매입/미수금 등 업무 로직이
-- 그대로 의존하고 있어 손대지 않는다. inventory_locations는 그 합계를
-- "이 위치엔 몇 개"로 쪼개서 보여주는 보조 데이터로, 처음엔 전부 미지정
-- (빈 테이블)으로 시작해서 실사하면서 하나씩 채워 넣는다.

create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid not null references public.warehouses (id) on delete cascade,
  rack text not null,
  tier smallint not null check (tier in (1, 2)),
  position smallint not null check (position in (1, 2)),
  code text not null unique,
  created_at timestamptz not null default now(),
  is_demo boolean not null default public.is_demo_actor(),
  unique (warehouse_id, rack, tier, position)
);

create table if not exists public.inventory_locations (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  location_id uuid not null references public.locations (id) on delete cascade,
  quantity numeric not null default 0 check (quantity >= 0),
  updated_at timestamptz not null default now(),
  is_demo boolean not null default public.is_demo_actor(),
  unique (product_id, location_id)
);

alter table public.locations enable row level security;
alter table public.inventory_locations enable row level security;

-- 나머지 업무 테이블과 동일한 패턴 — 로그인한 사용자면 조회/등록/수정/삭제
-- 가능(사내 ERP MVP 기준), 데모 계정 격리는 RESTRICTIVE 정책으로 별도 적용.
create policy "locations_select_authenticated" on public.locations
  for select using (auth.role() = 'authenticated');
create policy "locations_write_authenticated" on public.locations
  for insert with check (auth.role() = 'authenticated');
create policy "locations_update_authenticated" on public.locations
  for update using (auth.role() = 'authenticated');
create policy "locations_delete_authenticated" on public.locations
  for delete using (auth.role() = 'authenticated');

create policy "locations_demo_isolation" on public.locations
  as restrictive
  for all
  using (is_demo = public.is_demo_actor())
  with check (is_demo = public.is_demo_actor());

create policy "inventory_locations_select_authenticated" on public.inventory_locations
  for select using (auth.role() = 'authenticated');
create policy "inventory_locations_write_authenticated" on public.inventory_locations
  for insert with check (auth.role() = 'authenticated');
create policy "inventory_locations_update_authenticated" on public.inventory_locations
  for update using (auth.role() = 'authenticated');
create policy "inventory_locations_delete_authenticated" on public.inventory_locations
  for delete using (auth.role() = 'authenticated');

create policy "inventory_locations_demo_isolation" on public.inventory_locations
  as restrictive
  for all
  using (is_demo = public.is_demo_actor())
  with check (is_demo = public.is_demo_actor());

create index if not exists inventory_locations_location_id_idx
  on public.inventory_locations (location_id);
