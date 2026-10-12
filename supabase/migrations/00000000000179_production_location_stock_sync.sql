-- 헌법검사 보류 항목 처리 — 생산(자재투입/생산완료)이 매출/매입과 달리
-- inventory_locations(위치별 재고)를 전혀 건드리지 않고 있었다.
-- apply_location_stock_delta()/inventory_locations 자체는 이미 있는
-- 인프라라 새로 만들 건 없고, order_item_location_stock.order_type
-- 체크 제약만 'production'을 허용하도록 넓힌다 — 실제 동기화 호출은
-- src/lib/location-stock-sync.ts의 applyOrderLocationStock()을
-- production/actions.ts에서 그대로 재사용한다(매출/매입과 같은 TS
-- 레이어 함수이므로 이 마이그레이션 밖, 애플리케이션 코드에서 처리).
alter table public.order_item_location_stock
  drop constraint if exists order_item_location_stock_order_type_check;
alter table public.order_item_location_stock
  add constraint order_item_location_stock_order_type_check
  check (order_type in ('sale', 'purchase', 'production'));
