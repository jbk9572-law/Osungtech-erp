-- 공급처(매입처)별 매입단가 예약 기능. 거래처 단가 예약
-- (customer_product_prices + price_change_schedules)과 동일한 구조를 매입
-- 쪽에 그대로 미러링한다. supplier_product_prices는 "공급처+상품당 최신
-- 매입단가 하나"만 남기는 구조이므로, 미래 단가를 예약할 때는 이 테이블을
-- 바로 바꾸지 않고 purchase_price_change_schedules에 쌓아두었다가 효력일이
-- 되면(그 이후 조회 시점에) 반영한다.
create table if not exists public.supplier_product_prices (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  unit_cost numeric(12, 2) not null default 0,
  updated_at timestamptz not null default now(),
  unique (supplier_id, product_id)
);

alter table public.supplier_product_prices enable row level security;

drop policy if exists "supplier_product_prices_select_authenticated" on public.supplier_product_prices;
create policy "supplier_product_prices_select_authenticated" on public.supplier_product_prices
  for select using (auth.role() = 'authenticated');
drop policy if exists "supplier_product_prices_insert_authenticated" on public.supplier_product_prices;
create policy "supplier_product_prices_insert_authenticated" on public.supplier_product_prices
  for insert with check (auth.role() = 'authenticated');
drop policy if exists "supplier_product_prices_update_authenticated" on public.supplier_product_prices;
create policy "supplier_product_prices_update_authenticated" on public.supplier_product_prices
  for update using (auth.role() = 'authenticated');

drop trigger if exists set_supplier_product_prices_updated_at on public.supplier_product_prices;
create trigger set_supplier_product_prices_updated_at
  before update on public.supplier_product_prices
  for each row execute procedure public.set_updated_at();

create table if not exists public.purchase_price_change_schedules (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  new_unit_cost numeric(12, 2) not null,
  effective_date date not null,
  applied_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists purchase_price_change_schedules_pending_idx
  on public.purchase_price_change_schedules (supplier_id, product_id, effective_date)
  where applied_at is null;

alter table public.purchase_price_change_schedules enable row level security;

drop policy if exists "purchase_price_change_schedules_select_authenticated" on public.purchase_price_change_schedules;
create policy "purchase_price_change_schedules_select_authenticated" on public.purchase_price_change_schedules
  for select using (auth.role() = 'authenticated');
drop policy if exists "purchase_price_change_schedules_insert_authenticated" on public.purchase_price_change_schedules;
create policy "purchase_price_change_schedules_insert_authenticated" on public.purchase_price_change_schedules
  for insert with check (auth.role() = 'authenticated');
drop policy if exists "purchase_price_change_schedules_update_authenticated" on public.purchase_price_change_schedules;
create policy "purchase_price_change_schedules_update_authenticated" on public.purchase_price_change_schedules
  for update using (auth.role() = 'authenticated');
drop policy if exists "purchase_price_change_schedules_delete_authenticated" on public.purchase_price_change_schedules;
create policy "purchase_price_change_schedules_delete_authenticated" on public.purchase_price_change_schedules
  for delete using (auth.role() = 'authenticated');
