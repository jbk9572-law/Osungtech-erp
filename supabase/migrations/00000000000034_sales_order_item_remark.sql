-- 판매 품목별로 자유 텍스트 비고를 남길 수 있게 한다. 거래명세표/출고증
-- 인쇄 화면의 "비고" 칸은 이미 있었지만 입력할 곳이 없어서 항상 비어
-- 있었다.
alter table public.sales_order_items
  add column if not exists remark text;
