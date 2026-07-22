-- messenger_messages 테이블은 RLS로 "본인이 보낸 메시지만 삭제 가능"하게
-- 막아뒀는데(messenger_messages_delete_own), 짝을 이루는 스토리지 버킷
-- 정책은 로그인한 사용자면 누구든 파일을 지울 수 있게 되어 있었다(경로
-- 소유자 체크 없음). 업로드 시 경로를 항상 "{user.id}/파일명" 형태로
-- 쓰므로(messenger/actions.ts의 sendMessage), 경로의 첫 폴더가
-- 업로더 본인인 경우에만 삭제를 허용하도록 좁힌다.
drop policy if exists "messenger_attachments_authenticated_delete" on storage.objects;
create policy "messenger_attachments_owner_delete" on storage.objects
  for delete using (
    bucket_id = 'messenger-attachments'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
