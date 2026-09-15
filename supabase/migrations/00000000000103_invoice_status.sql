-- 계산서(세금계산서) 발행 "상태관리"만 우선 만든다. 실제 국세청 전송은
-- 팝빌/bill36524 같은 제3자 발행대행 API 사업자를 골라야 하는 별도
-- 결정이라 보류하고, 지금은 "발행했다/안 했다"를 수기로 기록만 한다.
--
-- invoice_provider 컬럼을 미리 넣어두는 게 이 마이그레이션의 핵심
-- 의도다 — 지금은 값이 항상 'manual'(수기 기록)이지만, 나중에 실제
-- API를 붙일 때 이 컬럼에 'popbill' 같은 값을 넣고 발행 액션 안에서
-- API 호출을 한 번 끼워 넣으면 된다. 화면(상태 배지, 발행일자/번호
-- 표시)과 테이블 구조는 그대로 재사용된다 — 나중에 다시 설계를 안
-- 갈아엎기 위한 장치.
alter table public.sales_orders
  add column if not exists invoice_status text not null default 'not_issued'
    check (invoice_status in ('not_issued', 'issued')),
  add column if not exists invoice_number text,
  add column if not exists invoice_issued_at date,
  add column if not exists invoice_provider text not null default 'manual';
