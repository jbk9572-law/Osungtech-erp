-- 매출(출고)/매입(입고) 저장 시 위치별 재고(inventory_locations)를 함께
-- 반영하기 위한 준비.
--
-- 1) inventory_locations.quantity의 quantity >= 0 제약을 없앤다. 이 회사는
--    "출고 전표를 먼저 뽑고 매입을 나중에(같은 날 안에) 등록"하는 경우가
--    잦다 — 그 순서대로면 출고를 반영하는 시점엔 아직 매입이 안 들어와서
--    위치 재고가 마이너스로 내려갈 수 있는데, 덧셈/뺄셈이라 나중에 매입이
--    들어오면(+) 최종값은 순서와 무관하게 항상 정확해진다. 반대로 0에서
--    막아버리면(클램프) 정보가 유실돼 매입을 나중에 넣어도 최종값이 틀어진다.
alter table public.inventory_locations
  drop constraint if exists inventory_locations_quantity_check;

-- 2) 매출/매입 건별로 "이 건 때문에 어느 위치에서 얼마나 빠지고/늘었는지"를
--    기록해둔다. 나중에 그 건을 수정하거나 삭제할 때, 원래 반영했던 만큼만
--    정확히 되돌릴 수 있어야 하기 때문이다(품목이 위치 2곳 이상에 나뉘어
--    있으면 그중 어디서 얼마나 뺐는지는 sales_order_items/purchase_order_items
--    자체에는 안 남아서, 이 표가 없으면 되돌릴 방법이 없다).
create table if not exists public.order_item_location_stock (
  id uuid primary key default gen_random_uuid(),
  order_type text not null check (order_type in ('sale', 'purchase')),
  order_id uuid not null,
  product_id uuid not null references public.products (id) on delete cascade,
  location_id uuid not null references public.locations (id) on delete cascade,
  -- 이 건 때문에 inventory_locations.quantity에 실제로 더해진 값(부호 있음).
  -- 되돌릴 때는 그냥 반대 부호로 다시 더하면 된다.
  quantity_delta numeric not null,
  created_at timestamptz not null default now(),
  is_demo boolean not null default public.is_demo_actor()
);

create index if not exists order_item_location_stock_order_idx
  on public.order_item_location_stock (order_type, order_id);

alter table public.order_item_location_stock enable row level security;

create policy "order_item_location_stock_select_authenticated" on public.order_item_location_stock
  for select using (auth.role() = 'authenticated');
create policy "order_item_location_stock_write_authenticated" on public.order_item_location_stock
  for insert with check (auth.role() = 'authenticated');
create policy "order_item_location_stock_delete_authenticated" on public.order_item_location_stock
  for delete using (auth.role() = 'authenticated');

create policy "order_item_location_stock_demo_isolation" on public.order_item_location_stock
  as restrictive
  for all
  using (is_demo = public.is_demo_actor())
  with check (is_demo = public.is_demo_actor());
