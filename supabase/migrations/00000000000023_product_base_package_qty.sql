-- 품목 엑셀 일괄등록에서 요구하는 "기초"(최소포장단위) 값을 저장할 컬럼.
-- 예: 1박스 = 100EA인 상품이면 unit='EA', base_package_qty=100.
alter table public.products
  add column if not exists base_package_qty numeric;
