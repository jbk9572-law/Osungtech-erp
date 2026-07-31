-- 종합 점검에서 나온 두 가지를 함께 처리한다.

-- 1) announcement_reads에 update/delete 정책이 없어서, 공지사항을 "읽음"으로
-- 표시한 뒤 다시 "안읽음"으로 되돌리는 toggleAnnouncementRead의 delete가
-- RLS에 막혀 조용히 0행 처리되고, 같은 행에 재차 upsert하면 내부적으로
-- update 경로를 타서 이것도 막힌다. select/insert만 있던 걸 보완한다.
drop policy if exists "announcement_reads_update_own" on public.announcement_reads;
create policy "announcement_reads_update_own" on public.announcement_reads
  for update using (auth.uid() = user_id);
drop policy if exists "announcement_reads_delete_own" on public.announcement_reads;
create policy "announcement_reads_delete_own" on public.announcement_reads
  for delete using (auth.uid() = user_id);

-- 2) Postgres는 외래키 컬럼에 인덱스를 자동으로 만들어주지 않는다. 매출/매입/
-- 재고 관련 테이블은 화면 대부분(목록 조회, 날짜 범위 검색, 거래처/공급처
-- 필터, 재고 상세 이력)에서 아래 컬럼들로 계속 필터링하는데 지금까지
-- 인덱스가 하나도 없었다 — 거래량이 지금의 몇 배로 늘면 순차 스캔이 된다.
create index if not exists sales_orders_order_date_idx on public.sales_orders (order_date);
create index if not exists sales_orders_customer_id_idx on public.sales_orders (customer_id);
create index if not exists purchase_orders_purchase_date_idx on public.purchase_orders (purchase_date);
create index if not exists purchase_orders_supplier_id_idx on public.purchase_orders (supplier_id);
create index if not exists sales_order_items_sales_order_id_idx on public.sales_order_items (sales_order_id);
create index if not exists sales_order_items_product_id_idx on public.sales_order_items (product_id);
create index if not exists purchase_order_items_purchase_order_id_idx on public.purchase_order_items (purchase_order_id);
create index if not exists purchase_order_items_product_id_idx on public.purchase_order_items (product_id);
create index if not exists inventory_transactions_product_id_idx on public.inventory_transactions (product_id);
create index if not exists inventory_transactions_warehouse_id_idx on public.inventory_transactions (warehouse_id);
create index if not exists inventory_transactions_sales_order_id_idx on public.inventory_transactions (sales_order_id);
create index if not exists inventory_transactions_purchase_order_id_idx on public.inventory_transactions (purchase_order_id);
