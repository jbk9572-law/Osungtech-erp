-- 매입(원지 발주) 쪽에서도 모조지 계산을 연결해 저장할 수 있게, 매출과
-- 동일한 방식으로 purchase_order_id를 추가한다. sales_order_id와 마찬가지로
-- null을 허용하고, 주문이 삭제되어도 계산 이력 자체는 남긴다.
alter table public.paper_calculations
  add column if not exists purchase_order_id uuid references public.purchase_orders (id) on delete set null;

create index if not exists paper_calculations_purchase_order_id_idx
  on public.paper_calculations (purchase_order_id);
