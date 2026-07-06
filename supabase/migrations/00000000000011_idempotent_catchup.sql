-- 지금까지의 모든 마이그레이션(001~010)을 몇 번을 다시 실행해도 안전하도록
-- 정리한 통합 스크립트. 정책(policy)은 이미 존재하면 그냥 건너뛰도록
-- (duplicate_object 예외를 무시) 작성해서, 이전에 일부만 실행했거나
-- 중간에 실패했더라도 이 파일을 몇 번이고 다시 실행해도 에러 없이 끝난다.

-- ── 컬럼 추가 (이미 있으면 건너뜀) ─────────────────────────────
alter table public.customers
  add column if not exists document_type text not null default '명세표'
  check (document_type in ('출고증', '명세표'));

alter table public.company_profile
  add column if not exists fax_number text,
  add column if not exists manager_name text,
  add column if not exists manager_phone text,
  add column if not exists email text,
  add column if not exists greeting_message text default '오늘 하루도 행복하십시요.',
  add column if not exists logo_wordmark_url text,
  add column if not exists logo_mark_url text,
  add column if not exists seal_image_url text;

alter table public.suppliers
  add column if not exists business_number text,
  add column if not exists representative_name text,
  add column if not exists notes text;

alter table public.customers
  add column if not exists notes text;

-- ── 정책 생성 (이미 있으면 조용히 건너뜀) ───────────────────────
do $$ begin
  create policy "profiles_select_own" on public.profiles
    for select using (auth.uid() = id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "profiles_update_own" on public.profiles
    for update using (auth.uid() = id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "categories_select_authenticated" on public.categories
    for select using (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "categories_write_authenticated" on public.categories
    for insert with check (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "categories_update_authenticated" on public.categories
    for update using (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "categories_delete_authenticated" on public.categories
    for delete using (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "suppliers_select_authenticated" on public.suppliers
    for select using (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "suppliers_write_authenticated" on public.suppliers
    for insert with check (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "suppliers_update_authenticated" on public.suppliers
    for update using (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "suppliers_delete_authenticated" on public.suppliers
    for delete using (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "warehouses_select_authenticated" on public.warehouses
    for select using (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "warehouses_write_authenticated" on public.warehouses
    for insert with check (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "warehouses_update_authenticated" on public.warehouses
    for update using (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "warehouses_delete_authenticated" on public.warehouses
    for delete using (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "products_select_authenticated" on public.products
    for select using (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "products_write_authenticated" on public.products
    for insert with check (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "products_update_authenticated" on public.products
    for update using (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "products_delete_authenticated" on public.products
    for delete using (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "inventory_select_authenticated" on public.inventory
    for select using (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "inventory_write_authenticated" on public.inventory
    for insert with check (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "inventory_update_authenticated" on public.inventory
    for update using (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "inventory_transactions_select_authenticated" on public.inventory_transactions
    for select using (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "inventory_transactions_insert_authenticated" on public.inventory_transactions
    for insert with check (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "company_profile_select_authenticated" on public.company_profile
    for select using (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "company_profile_update_authenticated" on public.company_profile
    for update using (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "customers_select_authenticated" on public.customers
    for select using (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "customers_insert_authenticated" on public.customers
    for insert with check (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "customers_update_authenticated" on public.customers
    for update using (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "customers_delete_authenticated" on public.customers
    for delete using (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "customer_product_prices_select_authenticated" on public.customer_product_prices
    for select using (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "customer_product_prices_insert_authenticated" on public.customer_product_prices
    for insert with check (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "customer_product_prices_update_authenticated" on public.customer_product_prices
    for update using (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "sales_orders_select_authenticated" on public.sales_orders
    for select using (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "sales_orders_insert_authenticated" on public.sales_orders
    for insert with check (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "sales_orders_update_authenticated" on public.sales_orders
    for update using (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "sales_orders_delete_authenticated" on public.sales_orders
    for delete using (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "sales_order_items_select_authenticated" on public.sales_order_items
    for select using (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "sales_order_items_insert_authenticated" on public.sales_order_items
    for insert with check (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "sales_order_items_update_authenticated" on public.sales_order_items
    for update using (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "sales_order_items_delete_authenticated" on public.sales_order_items
    for delete using (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "purchase_orders_select_authenticated" on public.purchase_orders
    for select using (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "purchase_orders_insert_authenticated" on public.purchase_orders
    for insert with check (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "purchase_orders_update_authenticated" on public.purchase_orders
    for update using (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "purchase_orders_delete_authenticated" on public.purchase_orders
    for delete using (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "purchase_order_items_select_authenticated" on public.purchase_order_items
    for select using (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "purchase_order_items_insert_authenticated" on public.purchase_order_items
    for insert with check (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "purchase_order_items_update_authenticated" on public.purchase_order_items
    for update using (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "purchase_order_items_delete_authenticated" on public.purchase_order_items
    for delete using (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "calendar_notes_select_authenticated" on public.calendar_notes
    for select using (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "calendar_notes_insert_authenticated" on public.calendar_notes
    for insert with check (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "calendar_notes_update_authenticated" on public.calendar_notes
    for update using (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;

-- ── 브랜딩 이미지 스토리지 버킷 ─────────────────────────────────
insert into storage.buckets (id, name, public)
values ('branding', 'branding', true)
on conflict (id) do nothing;

do $$ begin
  create policy "branding_public_read" on storage.objects
    for select using (bucket_id = 'branding');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "branding_authenticated_insert" on storage.objects
    for insert with check (bucket_id = 'branding' and auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "branding_authenticated_update" on storage.objects
    for update using (bucket_id = 'branding' and auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "branding_authenticated_delete" on storage.objects
    for delete using (bucket_id = 'branding' and auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;
