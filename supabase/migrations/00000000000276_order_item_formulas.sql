-- 매출/매입 품목 칸에 엑셀식 계산식(예: =600*2)으로 입력한 경우, 그 식을 저장해 다시 열어도 볼 수 있게 한다
-- (입력자가 계산을 잘못했을 때 식을 보고 알아채기 위함 — 값만 남으면 어떻게 나온 숫자인지 알 수 없다).
-- 재고/원가(FIFO)를 다루는 핵심 DB 함수(create/update_*_with_items)는 건드리지 않는다 — 식은 전표 단위 보조 정보(jsonb)로
-- 저장 후 따로 기록하고, 읽을 때 (품목 키, 수량, 단가)가 식의 계산 결과와 맞는 줄에만 붙인다(lib/item-formulas.ts).
-- 형식: [{"k":"<productId 또는 c:직접입력명>","q":"=600*2","p":"=1000+25"}, ...] — 식이 있는 줄만.
alter table public.sales_orders add column if not exists item_formulas jsonb;
alter table public.purchase_orders add column if not exists item_formulas jsonb;
