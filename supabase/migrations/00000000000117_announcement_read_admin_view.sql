-- 공지사항 읽음 현황을 관리자가 볼 수 있게 한다 — 지금까지는
-- announcement_reads의 select 정책이 "본인 읽음 기록만" 이었어서, 관리자도
-- 포함해 그 누구도 "이 공지를 누가 아직 안 읽었는지"를 확인할 방법이
-- 없었다. 고정(pinned, 사실상 필독) 공지에서 특히 필요한 기능이다.
create policy "announcement_reads_select_admin" on public.announcement_reads
  for select using (public.is_admin());
