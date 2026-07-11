-- 매출 품목 비고(00000000000034)와 동일하게, 매입 품목에도 자유 텍스트
-- 비고를 남길 수 있게 한다.
alter table public.purchase_order_items
  add column if not exists remark text;
