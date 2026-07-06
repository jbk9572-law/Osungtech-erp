-- 매입(입고) 관리 스키마

-- 매입 거래 (헤더)
create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers (id) on delete restrict,
  warehouse_id uuid not null references public.warehouses (id) on delete restrict,
  purchase_date date not null default current_date,
  memo text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- 매입 거래 품목 (매입 시점의 수량/단가 스냅샷)
create table if not exists public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_cost numeric(12, 2) not null default 0,
  created_at timestamptz not null default now()
);

-- 매입으로 인한 입고를 재고 이력에서 추적하기 위한 연결 컬럼
alter table public.inventory_transactions
  add column if not exists purchase_order_id uuid references public.purchase_orders (id) on delete set null;

alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;

create policy "purchase_orders_select_authenticated" on public.purchase_orders
  for select using (auth.role() = 'authenticated');
create policy "purchase_orders_insert_authenticated" on public.purchase_orders
  for insert with check (auth.role() = 'authenticated');

create policy "purchase_order_items_select_authenticated" on public.purchase_order_items
  for select using (auth.role() = 'authenticated');
create policy "purchase_order_items_insert_authenticated" on public.purchase_order_items
  for insert with check (auth.role() = 'authenticated');
