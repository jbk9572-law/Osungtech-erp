-- calendar_notes는 로그 방식으로 바뀐 뒤(migration 78) 수정 정책은
-- 없앴지만 삭제 정책은 아예 만든 적이 없었다 — 테스트 삼아 적은 메모를
-- 지울 방법이 화면에도, DB에도 없었다. 다른 화면들과 같은 기준(작성자
-- 본인 또는 관리자)으로 삭제만 허용한다.
create policy "calendar_notes_delete_owner_or_admin" on public.calendar_notes
  for delete using (created_by = auth.uid() or public.is_admin());
