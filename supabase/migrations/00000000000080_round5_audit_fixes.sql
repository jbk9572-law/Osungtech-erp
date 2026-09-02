-- 5차 정기 감사에서 확인된 것을 고친다.
--
-- paper_calculations는 created_by가 있는데도 delete 정책이 여태
-- "로그인만 하면 전부 허용"으로 남아있었다 — 애플리케이션 코드
-- (deletePaperCalculation)가 그 계산이 딸린 매출/매입 건의 관리 권한을
-- 확인하긴 하지만, 그건 DB가 아니라 서버 액션 레벨의 확인이라 RLS 자체는
-- 여전히 뚫려 있었다. 본인이거나 관리자만 지울 수 있게 좁힌다.
drop policy if exists "paper_calculations_delete_authenticated" on public.paper_calculations;
create policy "paper_calculations_delete_owner_or_admin" on public.paper_calculations
  for delete using (created_by = auth.uid() or public.is_admin());
