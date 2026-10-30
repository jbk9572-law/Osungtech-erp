-- 50개+ 테넌트로 늘어나도 목록 화면이 느려지지 않게, 가장 자주 쓰이는
-- "테넌트 필터 + 날짜 범위 + 최신순 정렬" 조회 패턴에 맞춘 복합
-- 인덱스를 추가한다(사용자 요청 — 확장 대비 인덱스 최적화).
--
-- 지금은 tenant_id 단독 인덱스(migration 099, 전 테이블 공통 반복문)와
-- order_date/purchase_date/created_at 단독 인덱스(migration 051, 074)가
-- 따로따로만 있다. 매출/매입/재고이력/변경이력 목록 화면은 전부
-- "이 테넌트 것 중에서 기간 내 + 최신순"으로 조회하므로, 테넌트가 많아질
-- 수록 단독 인덱스 하나만 타서 다른 테넌트 행까지 다량 훑고 걸러내는
-- 비효율이 커진다. (tenant_id, 날짜 desc) 복합 인덱스 하나면 정확히 그
-- 범위만 순서대로 바로 긁어올 수 있다. RLS가 모든 조회에 tenant_id 필터를
-- 이미 강제하므로 선행 컬럼으로 두는 게 항상 유효하다.
create index if not exists sales_orders_tenant_date_idx
  on public.sales_orders (tenant_id, order_date desc);

create index if not exists purchase_orders_tenant_date_idx
  on public.purchase_orders (tenant_id, purchase_date desc);

create index if not exists inventory_transactions_tenant_created_idx
  on public.inventory_transactions (tenant_id, created_at desc);

create index if not exists audit_logs_tenant_created_idx
  on public.audit_logs (tenant_id, created_at desc);

-- 거래처/공급처/품목 "검색(q)"은 지금 DB에서 ILIKE로 걸러지는 게
-- 아니라, 날짜 범위로 먼저 가져온 뒤 그 결과를 애플리케이션 메모리에서
-- JS로 필터링하는 방식이다(sales/page.tsx의 matchesSearch 등) — 그래서
-- 이름 검색용 trigram 인덱스는 지금 코드에서는 실제로 안 쓰여 추가하지
-- 않았다. 테넌트당 데이터가 많이 쌓이면 "검색어가 있을 때는 DB에서
-- ilike로 거른 뒤 가져오기"로 바꾸는 게 다음 단계로 더 효과적이다 —
-- 그때 가서 이 커밋에 trigram 인덱스를 추가하면 된다.
