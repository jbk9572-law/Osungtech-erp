-- 보안 점검 후속.
--
--  1) 스토리지 3개 버킷(branding·messenger-attachments·payment-receipts)의 SELECT(목록 조회) 정책이 "로그인한 누구나 전 회사 파일"이었다(migration 253은 비로그인만 막았다).
--     → 다른 회사 직원·포털 계정도 자기 로그인으로 /storage/v1/object/list 를 불러 영수증·메신저 첨부·도장·서명 파일 경로를 전부 열거할 수 있었다.
--     이제 내 회사 파일만 목록·조회된다. (버킷은 공개라 이미 아는 주소로 여는 것은 그대로다 — 경로를 알아낼 수 있던 통로를 막는 것이다.)
--       · branding: 회사id/…, demo/회사id/…, 같은 회사 직원의 signatures/<사용자id>.png, 예전의 폴더 없는 파일(이전 위치 그대로 보임)
--       · messenger-attachments: 같은 회사 직원 id 폴더
--       · payment-receipts: 내 회사 지급결의서 id 폴더
--  2) insert_payment_request_line_item / insert_payment_request_receipt: 같은 회사인지만 확인해서 동료의 지급결의서에 내역·영수증을 끼워 넣을 수 있었다.
--     → 작성자 본인 또는 관리자만(migration 76의 수정·삭제 규칙과 같다). "오늘 지출 빠른 등록"은 항상 호출자 본인 소유 문서를 찾거나 만들어 쓰므로 영향이 없다.

-- ── 1) 스토리지 목록·조회를 내 회사로 ─────────────────────────
drop policy if exists "branding_public_read" on storage.objects;
create policy "branding_public_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'branding'
    and (
      array_length(storage.foldername(name), 1) is null
      or (storage.foldername(name))[1] = public.current_tenant_id()::text
      or ((storage.foldername(name))[1] = 'demo' and (storage.foldername(name))[2] = public.current_tenant_id()::text)
      or (
        (storage.foldername(name))[1] = 'signatures'
        and exists (
          select 1 from public.profiles p
          where p.id::text = split_part(storage.filename(name), '.', 1) and p.tenant_id = public.current_tenant_id()
        )
      )
    )
  );

drop policy if exists "messenger_attachments_public_read" on storage.objects;
create policy "messenger_attachments_public_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'messenger-attachments'
    and exists (
      select 1 from public.profiles p
      where p.id::text = (storage.foldername(name))[1] and p.tenant_id = public.current_tenant_id()
    )
  );

drop policy if exists "payment_receipts_public_read" on storage.objects;
create policy "payment_receipts_public_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'payment-receipts'
    and exists (
      select 1 from public.payment_requests pr
      where pr.id::text = (storage.foldername(name))[1] and pr.tenant_id = public.current_tenant_id()
    )
  );

-- ── 2) 지급결의서 내역·영수증 함수: 작성자 본인 또는 관리자만 ─────────
create or replace function public.insert_payment_request_line_item(
  p_payment_request_id uuid,
  p_used_at date,
  p_vendor text,
  p_purpose text,
  p_amount numeric,
  p_remark text,
  p_is_highlighted boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_owner uuid;
  v_next integer;
  v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext(p_payment_request_id::text));

  select status, requested_by into v_status, v_owner from public.payment_requests
  where id = p_payment_request_id and tenant_id = public.current_tenant_id();
  if not found then
    raise exception '지급결의서를 찾을 수 없습니다.';
  end if;
  if v_owner is distinct from auth.uid() and not public.is_admin() then
    raise exception '본인이 작성한 지급결의서에만 내역을 추가할 수 있습니다.';
  end if;
  if v_status is distinct from 'draft' then
    raise exception '이미 제출(마감)된 지급결의서에는 내역을 추가할 수 없습니다.';
  end if;

  select coalesce(max(sort_order), -1) + 1
    into v_next
    from public.payment_request_line_items
    where payment_request_id = p_payment_request_id;

  insert into public.payment_request_line_items
    (payment_request_id, used_at, vendor, purpose, amount, remark, sort_order, is_highlighted)
  values
    (p_payment_request_id, p_used_at, p_vendor, p_purpose, p_amount, p_remark, v_next, p_is_highlighted)
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.insert_payment_request_receipt(
  p_payment_request_id uuid,
  p_file_path text,
  p_file_url text,
  p_created_by uuid,
  p_size_bytes integer default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_next integer;
  v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext(p_payment_request_id::text));

  select requested_by into v_owner from public.payment_requests
  where id = p_payment_request_id and tenant_id = public.current_tenant_id();
  if not found then
    raise exception '지급결의서를 찾을 수 없습니다.';
  end if;
  if v_owner is distinct from auth.uid() and not public.is_admin() then
    raise exception '본인이 작성한 지급결의서에만 영수증을 추가할 수 있습니다.';
  end if;

  select coalesce(max(sort_order), -1) + 1
    into v_next
    from public.payment_request_receipts
    where payment_request_id = p_payment_request_id;

  insert into public.payment_request_receipts
    (payment_request_id, file_path, file_url, sort_order, created_by, size_bytes)
  values
    (p_payment_request_id, p_file_path, p_file_url, v_next, coalesce(auth.uid(), p_created_by), p_size_bytes)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.insert_payment_request_line_item(uuid, date, text, text, numeric, text, boolean) from public, anon;
revoke all on function public.insert_payment_request_receipt(uuid, text, text, uuid, integer) from public, anon;
grant execute on function public.insert_payment_request_line_item(uuid, date, text, text, numeric, text, boolean) to authenticated;
grant execute on function public.insert_payment_request_receipt(uuid, text, text, uuid, integer) to authenticated;
