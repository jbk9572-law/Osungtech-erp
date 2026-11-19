-- 거래처/공급처 "결제조건"(예: 월말 마감 · 익월 말 결제) — 자유 입력 한 줄.
-- 업종마다 결제 관행(현금/어음/월말/선결제…)이 달라 코드값으로 고정하지 않고 글로 둔다.
-- 계산에는 쓰지 않는다(연체 판단은 미수금 연령 기준 30일 그대로) — 담당자가 보는 참고 정보.
-- 새 칸은 nullable이라 기존 행/기존 insert는 영향 없다. RLS는 테이블 단위 정책이 그대로 적용된다.
alter table public.customers add column if not exists payment_terms text;
alter table public.suppliers add column if not exists payment_terms text;
