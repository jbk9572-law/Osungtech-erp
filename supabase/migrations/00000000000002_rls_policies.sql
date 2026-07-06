-- RLS 활성화
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.suppliers enable row level security;
alter table public.warehouses enable row level security;
alter table public.products enable row level security;
alter table public.inventory enable row level security;
alter table public.inventory_transactions enable row level security;

-- profiles: 본인 프로필만 조회/수정
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- 나머지 테이블: 로그인한 모든 사용자가 조회/등록/수정 가능 (사내 ERP MVP 기준)
create policy "categories_select_authenticated" on public.categories
  for select using (auth.role() = 'authenticated');
create policy "categories_write_authenticated" on public.categories
  for insert with check (auth.role() = 'authenticated');
create policy "categories_update_authenticated" on public.categories
  for update using (auth.role() = 'authenticated');
create policy "categories_delete_authenticated" on public.categories
  for delete using (auth.role() = 'authenticated');

create policy "suppliers_select_authenticated" on public.suppliers
  for select using (auth.role() = 'authenticated');
create policy "suppliers_write_authenticated" on public.suppliers
  for insert with check (auth.role() = 'authenticated');
create policy "suppliers_update_authenticated" on public.suppliers
  for update using (auth.role() = 'authenticated');
create policy "suppliers_delete_authenticated" on public.suppliers
  for delete using (auth.role() = 'authenticated');

create policy "warehouses_select_authenticated" on public.warehouses
  for select using (auth.role() = 'authenticated');
create policy "warehouses_write_authenticated" on public.warehouses
  for insert with check (auth.role() = 'authenticated');
create policy "warehouses_update_authenticated" on public.warehouses
  for update using (auth.role() = 'authenticated');
create policy "warehouses_delete_authenticated" on public.warehouses
  for delete using (auth.role() = 'authenticated');

create policy "products_select_authenticated" on public.products
  for select using (auth.role() = 'authenticated');
create policy "products_write_authenticated" on public.products
  for insert with check (auth.role() = 'authenticated');
create policy "products_update_authenticated" on public.products
  for update using (auth.role() = 'authenticated');
create policy "products_delete_authenticated" on public.products
  for delete using (auth.role() = 'authenticated');

create policy "inventory_select_authenticated" on public.inventory
  for select using (auth.role() = 'authenticated');
create policy "inventory_write_authenticated" on public.inventory
  for insert with check (auth.role() = 'authenticated');
create policy "inventory_update_authenticated" on public.inventory
  for update using (auth.role() = 'authenticated');

create policy "inventory_transactions_select_authenticated" on public.inventory_transactions
  for select using (auth.role() = 'authenticated');
create policy "inventory_transactions_insert_authenticated" on public.inventory_transactions
  for insert with check (auth.role() = 'authenticated');
