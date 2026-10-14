-- 헌법검사: approval_documents_delete_own이 작성자 본인이면 상태와
-- 무관하게 삭제를 허용하고 있었다(migration 102) — 이미 승인완료/반려된
-- 기안서도 작성자가 그냥 지울 수 있어, 결재 이력(감사 기록)이 통째로
-- 사라질 수 있는 구멍이었다. deleteApprovalDraft가 이미 상태를 'draft'로
-- 제한하는 것과 같은 이유로, 작성자 본인 삭제는 아직 결재가 최종
-- 확정되지 않은 상태(draft/pending/recalled)로만 제한한다. 관리자는
-- 기존처럼 상태와 무관하게 삭제할 수 있다(이미 다른 테이블에서도
-- is_admin()에 부여된 전역 권한과 동일한 성격).
drop policy if exists "approval_documents_delete_own" on public.approval_documents;
create policy "approval_documents_delete_own" on public.approval_documents
  for delete using (
    (created_by = auth.uid() and status in ('draft', 'pending', 'recalled'))
    or public.is_admin()
  );
