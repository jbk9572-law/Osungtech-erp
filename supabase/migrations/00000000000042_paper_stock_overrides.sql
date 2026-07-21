-- TG0(모조지) 자동반영 수량을 수동으로 덮어쓸 수 있게 하는 기능. 기본
-- 동작(자동 계산값 반영)은 그대로 유지하되, 거래처와 협의해서 다른
-- 수량(예: 3.2연 계산됐지만 3연으로 청구)으로 바꿔야 할 때 이 로그를 통해
-- 수동값으로 고정하고, 나중에 다시 자동값으로 되돌릴 수도 있게 한다.
-- 한 주문에 대해 이 테이블에 이력이 쌓이고, reverted_at이 비어있는 가장
-- 최근 행이 "현재 적용 중인 수동값"이다.
create table if not exists public.paper_stock_overrides (
  id uuid primary key default gen_random_uuid(),
  sales_order_id uuid references public.sales_orders (id) on delete cascade,
  purchase_order_id uuid references public.purchase_orders (id) on delete cascade,
  auto_quantity numeric(12, 2) not null,
  override_quantity numeric(12, 2) not null,
  note text,
  reverted_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint paper_stock_overrides_one_order check (
    (sales_order_id is not null and purchase_order_id is null)
    or (sales_order_id is null and purchase_order_id is not null)
  )
);

create index if not exists paper_stock_overrides_sales_order_idx
  on public.paper_stock_overrides (sales_order_id, created_at desc);
create index if not exists paper_stock_overrides_purchase_order_idx
  on public.paper_stock_overrides (purchase_order_id, created_at desc);

alter table public.paper_stock_overrides enable row level security;

drop policy if exists "paper_stock_overrides_select_authenticated" on public.paper_stock_overrides;
create policy "paper_stock_overrides_select_authenticated" on public.paper_stock_overrides
  for select using (auth.role() = 'authenticated');
drop policy if exists "paper_stock_overrides_insert_authenticated" on public.paper_stock_overrides;
create policy "paper_stock_overrides_insert_authenticated" on public.paper_stock_overrides
  for insert with check (auth.role() = 'authenticated');
drop policy if exists "paper_stock_overrides_update_authenticated" on public.paper_stock_overrides;
create policy "paper_stock_overrides_update_authenticated" on public.paper_stock_overrides
  for update using (auth.role() = 'authenticated');
