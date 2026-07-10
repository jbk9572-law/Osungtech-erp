-- 마감일이 지난 할일 알림(종/팝업/대시보드 배너)을 계속 반복해서 띄우지
-- 않기 위한 컬럼. 할일 자체의 완료(done) 여부와는 무관하며, 알림 표시
-- 여부만 제어한다(할일 목록 자체에서는 계속 미완료/기한초과로 보인다).
alter table public.todos
  add column if not exists alarm_muted_at timestamptz;
