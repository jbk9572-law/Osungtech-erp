-- 거래처+품목(또는 공급처+품목) 조합 전용 특이사항. customers.notes/
-- suppliers.notes는 그 거래처 전체에 대한 특이사항이라, "이 거래처가 이
-- 특정 품목을 살 때만" 같은 조합별 안내는 담을 자리가 없었다.
-- customer_product_prices/supplier_product_prices가 이미 "거래처(공급처)+
-- 품목당 한 행"인 구조라 여기에 붙이는 게 자연스럽다.
alter table public.customer_product_prices
  add column if not exists notes text;

alter table public.supplier_product_prices
  add column if not exists notes text;
