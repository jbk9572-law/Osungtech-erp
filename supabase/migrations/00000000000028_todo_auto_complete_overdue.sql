-- 마감일 지난 할일 알림을 "음소거"만 하는 대신 완료(done) 자동 처리로
-- 바꾸면서, 더 이상 쓰이지 않는 alarm_muted_at 컬럼을 제거한다.
alter table public.todos
  drop column if exists alarm_muted_at;
