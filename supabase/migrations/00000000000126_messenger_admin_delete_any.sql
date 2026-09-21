-- 지금까지 사내메신저는 "본인이 보낸 메시지만" 삭제할 수 있었다. 계정을
-- 삭제해도 그 계정이 남긴 메시지는 messenger_messages.sender_id가
-- "on delete set null"이라 지워지지 않고 보낸 사람 표시만 사라진 채
-- 그대로 남는데, 이제 그 계정 본인이 없으니 아무도(관리자조차) 못
-- 지우는 채로 영구히 쌓인다 — 관리자는 이런 정리를 할 수 있어야 한다.
-- messenger_messages는 이미 tenant_id 기반 RESTRICTIVE 정책(migration 99)이
-- 걸려있어서, 아래처럼 넓혀도 다른 회사 메시지까지 지울 수 있게 되는 건
-- 아니다(같은 테넌트 안에서만 허용).
drop policy if exists "messenger_messages_delete_own" on public.messenger_messages;
create policy "messenger_messages_delete_own_or_admin" on public.messenger_messages
  for delete using (
    sender_id = auth.uid()
    or exists (
      select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- 첨부파일 스토리지 삭제 정책(migration 45)도 관리자면 남의 폴더에 있는
-- 파일도 지울 수 있게 같이 넓힌다 — 메시지 행만 지워지고 첨부파일은
-- 스토리지에 그대로 남는 것을 막기 위함.
drop policy if exists "messenger_attachments_owner_delete" on storage.objects;
create policy "messenger_attachments_owner_or_admin_delete" on storage.objects
  for delete using (
    bucket_id = 'messenger-attachments'
    and auth.role() = 'authenticated'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
      )
    )
  );
