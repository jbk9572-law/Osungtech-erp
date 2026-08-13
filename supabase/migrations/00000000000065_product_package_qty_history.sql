-- KG 등으로 포장하는 품목은 "1박스당 수량"이 매번 실제로 담기는 양에
-- 따라 조금씩 달라진다. 지금까지는 products.base_package_qty 하나만
-- 계속 덮어써서 예전에 어떤 값으로 포장했었는지 기록이 사라졌다.
-- 단가 이력(sales_order_items 등)과 같은 개념으로, 값이 바뀔 때마다
-- 이력을 남겨서 상품 수정 화면에서 "이전 포장수량" 목록을 보여주고
-- 그중 하나로 다시 덮어쓸 수 있게 한다.
create table if not exists public.product_package_qty_history (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  base_package_qty numeric not null,
  changed_by uuid references public.profiles (id) on delete set null,
  changed_at timestamptz not null default now()
);

create index if not exists product_package_qty_history_product_id_idx
  on public.product_package_qty_history (product_id, changed_at desc);

alter table public.product_package_qty_history enable row level security;

drop policy if exists "product_package_qty_history_select_authenticated" on public.product_package_qty_history;
create policy "product_package_qty_history_select_authenticated" on public.product_package_qty_history
  for select using (auth.role() = 'authenticated');
drop policy if exists "product_package_qty_history_insert_authenticated" on public.product_package_qty_history;
create policy "product_package_qty_history_insert_authenticated" on public.product_package_qty_history
  for insert with check (auth.role() = 'authenticated');
