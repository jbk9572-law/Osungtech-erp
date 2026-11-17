-- 스토리지 버킷 회사 격리(보안 점검 결과).
--
--  1) 회사 로고·도장(branding)은 파일 경로가 회사 구분 없이 'logo-wordmark.png' 같은 고정 이름이었다. 업로드는 같은 경로에 덮어쓰기(upsert)라서
--     두 번째 회사가 로고를 올리면 첫 회사의 로고 파일이 바뀌어 버렸고, 정책도 "로그인한 누구나 수정·삭제"라 다른 회사 사용자가 직접 지울 수도 있었다.
--     → 앱은 이제 '회사id/…' 폴더에 저장한다(코드 변경). 정책은 내 회사 폴더(데모는 demo/회사id/…, 서명은 signatures/…)만 쓰기·수정·삭제를 허용한다.
--        (이전 위치의 기존 파일은 그대로 보이고, 회사가 로고를 다시 올리면 새 위치로 옮겨진다.)
--  2) branding / messenger-attachments / payment-receipts 의 select 정책에 "to" 가 없어 비로그인(anon)도 파일 목록을 조회할 수 있었다.
--     버킷은 공개(public)라서 이미 아는 URL로 보는 것은 정책과 무관하게 계속 된다 → 목록 조회만 로그인 사용자로 한정한다.
--  3) messenger-attachments: 올리기는 내 uid 폴더에만, 지우기의 '관리자' 조건은 같은 회사 사용자의 폴더에만 해당하게 한다(다른 회사 관리자가 지울 수 없게).
--  4) payment-receipts: 올리기는 내 회사 지급결의서 id 폴더에만.

-- ── branding ─────────────────────────────────────────────
drop policy if exists "branding_public_read" on storage.objects;
create policy "branding_public_read" on storage.objects
  for select to authenticated using (bucket_id = 'branding');

drop policy if exists "branding_authenticated_insert" on storage.objects;
drop policy if exists "branding_authenticated_update" on storage.objects;
drop policy if exists "branding_authenticated_delete" on storage.objects;

create policy "branding_own_tenant_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'branding'
    and (
      (storage.foldername(name))[1] = public.current_tenant_id()::text
      or ((storage.foldername(name))[1] = 'demo' and (storage.foldername(name))[2] = public.current_tenant_id()::text)
      or ((storage.foldername(name))[1] = 'signatures' and storage.filename(name) like auth.uid()::text || '%')
    )
  );
create policy "branding_own_tenant_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'branding'
    and (
      (storage.foldername(name))[1] = public.current_tenant_id()::text
      or ((storage.foldername(name))[1] = 'demo' and (storage.foldername(name))[2] = public.current_tenant_id()::text)
      or ((storage.foldername(name))[1] = 'signatures' and storage.filename(name) like auth.uid()::text || '%')
    )
  );
create policy "branding_own_tenant_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'branding'
    and (
      (storage.foldername(name))[1] = public.current_tenant_id()::text
      or ((storage.foldername(name))[1] = 'demo' and (storage.foldername(name))[2] = public.current_tenant_id()::text)
      or ((storage.foldername(name))[1] = 'signatures' and storage.filename(name) like auth.uid()::text || '%')
    )
  );

-- ── messenger-attachments ────────────────────────────────
drop policy if exists "messenger_attachments_public_read" on storage.objects;
create policy "messenger_attachments_public_read" on storage.objects
  for select to authenticated using (bucket_id = 'messenger-attachments');

drop policy if exists "messenger_attachments_authenticated_insert" on storage.objects;
create policy "messenger_attachments_own_folder_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'messenger-attachments' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "messenger_attachments_owner_or_admin_delete" on storage.objects;
create policy "messenger_attachments_owner_or_admin_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'messenger-attachments'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (
        exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
        and exists (
          select 1 from public.profiles o
          where o.id::text = (storage.foldername(name))[1] and o.tenant_id = public.current_tenant_id()
        )
      )
    )
  );

-- ── payment-receipts ─────────────────────────────────────
drop policy if exists "payment_receipts_public_read" on storage.objects;
create policy "payment_receipts_public_read" on storage.objects
  for select to authenticated using (bucket_id = 'payment-receipts');

drop policy if exists "payment_receipts_authenticated_insert" on storage.objects;
create policy "payment_receipts_own_tenant_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'payment-receipts'
    and exists (
      select 1 from public.payment_requests pr
      where pr.id::text = (storage.foldername(name))[1] and pr.tenant_id = public.current_tenant_id()
    )
  );
