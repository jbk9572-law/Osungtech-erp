-- notifications.ts의 getNotificationSummary는 레이아웃(모든 페이지)에서 매번
-- 호출되는데, 여기서 필터링하는 todos.due_date/done과 announcements의
-- 정렬 기준(pinned, created_at)에는 migration 51에서도 인덱스가 빠져 있었다.
create index if not exists todos_due_date_not_done_idx
  on public.todos (due_date)
  where done = false;
create index if not exists announcements_pinned_created_at_idx
  on public.announcements (pinned, created_at);
