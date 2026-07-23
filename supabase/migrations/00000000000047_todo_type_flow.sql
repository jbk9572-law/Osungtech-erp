-- 할일에 유형을 추가한다: 매입만(purchase), 매출만/재고분 출고(sale),
-- 매입 후 매출까지(both). both는 출고예정일(ship_date)로 당일출고/날짜지정
-- 출고를 자동 구분한다(마감일과 같거나 비어있으면 당일출고).
--
-- 매입/매출 등록에서 "할일 가져오기"로 실제 등록까지 마치면 해당 방향의
-- *_done_at이 찍히고, 유형별 필요한 방향이 모두 끝나면 done 처리된다
-- (purchase: 매입만, sale: 매출만, both: 매입+매출 둘 다).
alter table public.todos
  add column if not exists todo_type text not null default 'purchase'
    check (todo_type in ('purchase', 'sale', 'both')),
  add column if not exists ship_date date,
  add column if not exists purchase_done_at timestamptz,
  add column if not exists sale_done_at timestamptz;
