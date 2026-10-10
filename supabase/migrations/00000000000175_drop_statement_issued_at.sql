-- 거래명세서 발행여부(statement_issued_at)는 애초에 어디서도 값을 쓰지
-- 않는 죽은 필드였다(마이그레이션 119에서 컬럼만 만들고 "다음 단계"로
-- 미뤄둔 채 끝) — 매출/매입 목록 화면에 "미발행" 배지만 항상 떠 있는
-- 의미 없는 컬럼이었던 걸 사용자가 확인하고 기능 자체를 없애기로 했다.
-- UI(명세서발행 컬럼)를 먼저 지우고, 이 마이그레이션으로 DB 컬럼도 같이
-- 제거해 죽은 상태를 완전히 정리한다.

alter table public.sales_orders
  drop column if exists statement_issued_at;

alter table public.purchase_orders
  drop column if exists statement_issued_at;
