-- 대시보드 메모를 "그날 한 칸 덮어쓰기"에서 "여러 사람이 그날그날 적은
-- 메모가 로그처럼 쌓이는" 방식으로 바꾼다. note_date의 UNIQUE 제약을
-- 없애 같은 날짜에 여러 행이 쌓일 수 있게 하고, 이제 각 행은 등록 후
-- 다시 고치지 않는(수정 없는) 로그 한 줄이라 updated_at 갱신 트리거와
-- update 정책도 함께 없앤다.
alter table public.calendar_notes
  drop constraint if exists calendar_notes_note_date_key;

drop trigger if exists set_calendar_notes_updated_at on public.calendar_notes;

alter table public.calendar_notes
  rename column updated_at to created_at;

drop policy if exists "calendar_notes_update_authenticated" on public.calendar_notes;

create index if not exists calendar_notes_note_date_idx
  on public.calendar_notes (note_date, created_at);
