-- 판매관리 확장 테이블 RLS
alter table public.company_profile enable row level security;
alter table public.customers enable row level security;
alter table public.customer_product_prices enable row level security;
alter table public.sales_orders enable row level security;
alter table public.sales_order_items enable row level security;

create policy "company_profile_select_authenticated" on public.company_profile
  for select using (auth.role() = 'authenticated');
create policy "company_profile_update_authenticated" on public.company_profile
  for update using (auth.role() = 'authenticated');

create policy "customers_select_authenticated" on public.customers
  for select using (auth.role() = 'authenticated');
create policy "customers_insert_authenticated" on public.customers
  for insert with check (auth.role() = 'authenticated');
create policy "customers_update_authenticated" on public.customers
  for update using (auth.role() = 'authenticated');
create policy "customers_delete_authenticated" on public.customers
  for delete using (auth.role() = 'authenticated');

create policy "customer_product_prices_select_authenticated" on public.customer_product_prices
  for select using (auth.role() = 'authenticated');
create policy "customer_product_prices_insert_authenticated" on public.customer_product_prices
  for insert with check (auth.role() = 'authenticated');
create policy "customer_product_prices_update_authenticated" on public.customer_product_prices
  for update using (auth.role() = 'authenticated');

create policy "sales_orders_select_authenticated" on public.sales_orders
  for select using (auth.role() = 'authenticated');
create policy "sales_orders_insert_authenticated" on public.sales_orders
  for insert with check (auth.role() = 'authenticated');

create policy "sales_order_items_select_authenticated" on public.sales_order_items
  for select using (auth.role() = 'authenticated');
create policy "sales_order_items_insert_authenticated" on public.sales_order_items
  for insert with check (auth.role() = 'authenticated');
