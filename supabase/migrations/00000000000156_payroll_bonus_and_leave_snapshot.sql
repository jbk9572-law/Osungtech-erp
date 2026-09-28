-- 급여명세(payslips)에 성과금/특별상여금, 그리고 그 달 기준 연차 잔여
-- 스냅샷을 추가한다. 연차는 이미 leave_balances/leave_requests로 별도
-- 관리되고 있어(hr/leave-balances) 새 테이블이 필요 없다 — 급여명세
-- 생성 시점의 총일수/사용일수만 그대로 복사해서 인쇄물에 찍히는 숫자가
-- 나중에 연차를 더 쓰거나 재설정해도 바뀌지 않게 고정한다(이미 나간
-- 명세서와 실제 화면 값이 달라지면 안 되므로).
alter table public.payslips
  add column if not exists bonus_performance numeric not null default 0,
  add column if not exists bonus_special numeric not null default 0,
  add column if not exists annual_leave_total numeric,
  add column if not exists annual_leave_used numeric;

comment on column public.payslips.bonus_performance is '성과금(급여명세 생성 후 관리자가 직접 입력, 4대보험 계산에 포함)';
comment on column public.payslips.bonus_special is '특별상여금(급여명세 생성 후 관리자가 직접 입력, 4대보험 계산에 포함)';
comment on column public.payslips.annual_leave_total is '급여명세 생성 시점의 해당 연도 연차 총 부여일수 스냅샷(leave_balances.total_days)';
comment on column public.payslips.annual_leave_used is '급여명세 생성 시점의 해당 연도 연차 사용일수 스냅샷(승인된 leave_requests 합계)';
