-- 같은 품목(예: 백(150))이라도 매출/매입 시점마다 실제 중량(33, 39, 31 등)이
-- 달라 단가는 같지만 규격만 매번 달라지는 경우가 있다. 품목 마스터(products)에는
-- 기본 규격만 두고, 각 주문 품목(sales_order_items/purchase_order_items)에
-- 그 거래 건에서 실제로 입력한 규격을 별도로 저장할 수 있게 컬럼을 추가한다.
-- null이면 화면에서 품목 마스터의 기본 규격을 그대로 보여준다.
alter table public.sales_order_items
  add column if not exists spec text;

alter table public.purchase_order_items
  add column if not exists spec text;
