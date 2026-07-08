-- 매입/매출 수량에 9.5처럼 소수점 입력이 가능하도록 quantity 컬럼들을
-- integer에서 numeric으로 변경한다. 기존 체크 제약(>0, >=0, <>0)은 그대로 유지된다.
alter table public.sales_order_items
  alter column quantity type numeric using quantity::numeric;

alter table public.purchase_order_items
  alter column quantity type numeric using quantity::numeric;

alter table public.inventory
  alter column quantity type numeric using quantity::numeric;

alter table public.inventory_transactions
  alter column quantity type numeric using quantity::numeric;
