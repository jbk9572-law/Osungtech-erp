-- 거래처 발주 1건에 품목이 여러 개 섞여 있을 때(제조품+사입품 혼합,
-- 또는 사입품 여러 개) 생기던 버그를 고친다: 지금까지는
-- customer_orders.work_order_id/sales_order_id가 "주문 전체"에 하나씩만
-- 있어서, 품목 하나를 전환하면 그 값이 채워지고 — 화면은 "이미
-- 전환됨"으로 보고 나머지 품목의 전환 버튼을 전부 숨겨버렸다(실제로는
-- 그 품목들만 전환 안 된 채로 남음). 전환 여부를 "주문" 단위가 아니라
-- "품목" 단위로 추적해야 한다.
alter table public.customer_order_items
  add column if not exists work_order_id uuid references public.work_orders (id) on delete set null,
  add column if not exists sales_order_id uuid references public.sales_orders (id) on delete set null;

create index if not exists customer_order_items_work_order_id_idx
  on public.customer_order_items (work_order_id);
create index if not exists customer_order_items_sales_order_id_idx
  on public.customer_order_items (sales_order_id);

-- 기존에 이미 생산지시/판매로 전환됐던 주문(customer_orders.work_order_id/
-- sales_order_id가 채워진 것)은, 그 주문의 품목이 1개뿐이었던 경우에
-- 한해서만 백필한다 — 품목이 여러 개였던 주문은 "그 중 어느 품목이
-- 전환됐는지"를 이제 와서 알 수 없어 건드리지 않는다(사람이 직접
-- 확인해야 하는 소수 사례로 남겨둔다).
update public.customer_order_items i
set work_order_id = o.work_order_id
from public.customer_orders o
where i.customer_order_id = o.id
  and o.work_order_id is not null
  and i.work_order_id is null
  and (select count(*) from public.customer_order_items i2 where i2.customer_order_id = o.id) = 1;

update public.customer_order_items i
set sales_order_id = o.sales_order_id
from public.customer_orders o
where i.customer_order_id = o.id
  and o.sales_order_id is not null
  and i.sales_order_id is null
  and (select count(*) from public.customer_order_items i2 where i2.customer_order_id = o.id) = 1;
