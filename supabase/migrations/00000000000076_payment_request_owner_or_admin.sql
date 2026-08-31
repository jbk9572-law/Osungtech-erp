-- (원래 파일명은 00000000000071_payment_request_owner_or_admin.sql이었다.
-- 71_sales_return_support.sql과 번호가 겹쳐 있었는데(같은 71), Supabase의
-- 마이그레이션 이력 테이블은 이 번호를 고유키로 쓰기 때문에 완전히 새로운
-- 환경에서 처음부터 재생하면 알파벳순으로 나중인 파일이 "이미 적용됨"으로
-- 착각돼 조용히 건너뛰어질 위험이 있었다. 이 파일은 sales_return_support와
-- 달리 이후 마이그레이션(72~75)이 의존하는 내용이 없어서(반품 관련 컬럼과
-- 무관, migration 69의 is_admin() 헬퍼만 사용) 순서에 영향 없이 뒤로
-- 옮길 수 있는 쪽이라 76으로 재번호했다. 이미 적용된 운영 DB의 스키마
-- 자체는 파일명과 무관하므로 이 변경 자체로는 아무 영향이 없다 — CLI
-- 마이그레이션 이력(schema_migrations)을 쓰는 환경에서 다시 적용하려 할 때만
-- 관련이 있으니, 그런 경우엔 이력 테이블 상태를 먼저 확인할 것.)

-- 지급결의서(payment_requests)는 "부서+카드종류+월+작성자"로 버킷이
-- 나뉘어 있어(migration 63) 실제로는 한 문서에 여러 사람이 섞여 들어가는
-- 구조가 아니다 — find_or_create_payment_request_bucket이 항상 호출자
-- 본인 소유 버킷만 찾거나 새로 만든다. 그래서 "오늘 지출 빠른 등록"
-- (quickAddPaymentRequestItem, 줄 하나만 insert)은 지금처럼 누구나 열어
-- 두고, 문서 전체를 갈아엎는 수정(update_payment_request_with_items,
-- 여러 줄을 통째로 지웠다가 다시 넣음)과 문서/영수증 삭제만 작성자
-- 본인 또는 관리자로 좁힌다.

create or replace function public.update_payment_request_with_items(
  p_id uuid,
  p_department text,
  p_period_from date,
  p_period_to date,
  p_card_type text,
  p_items jsonb
)
returns uuid
language plpgsql
as $$
declare
  v_owner uuid;
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;

  select requested_by into v_owner from public.payment_requests where id = p_id;
  if not found then
    raise exception '지급결의서를 찾을 수 없습니다.';
  end if;
  if v_owner is distinct from v_actor and not public.is_admin() then
    raise exception '본인이 작성한 지급결의서만 수정할 수 있습니다.';
  end if;

  update public.payment_requests
  set department = p_department,
      period_from = p_period_from,
      period_to = p_period_to,
      card_type = coalesce(nullif(p_card_type, ''), '개인카드')
  where id = p_id;

  delete from public.payment_request_line_items where payment_request_id = p_id;

  if jsonb_array_length(p_items) > 0 then
    insert into public.payment_request_line_items
      (payment_request_id, used_at, vendor, purpose, amount, remark, sort_order, is_highlighted)
    select
      p_id,
      (item->>'usedAt')::date,
      item->>'vendor',
      nullif(item->>'purpose', ''),
      (item->>'amount')::numeric,
      nullif(item->>'remark', ''),
      (item->>'sortOrder')::int,
      coalesce((item->>'isHighlighted')::boolean, false)
    from jsonb_array_elements(p_items) as item;
  end if;

  return p_id;
end;
$$;

-- RLS도 같은 조건으로(defense in depth) — 줄 추가(insert)는 그대로 열어두고
-- 문서/줄/영수증의 수정·삭제만 "그 문서의 작성자 또는 관리자"로 좁힌다.
drop policy if exists "payment_requests_update_authenticated" on public.payment_requests;
create policy "payment_requests_update_owner_or_admin" on public.payment_requests
  for update using (requested_by = auth.uid() or public.is_admin());

drop policy if exists "payment_requests_delete_authenticated" on public.payment_requests;
create policy "payment_requests_delete_owner_or_admin" on public.payment_requests
  for delete using (requested_by = auth.uid() or public.is_admin());

drop policy if exists "payment_request_line_items_update_authenticated" on public.payment_request_line_items;
create policy "payment_request_line_items_update_owner_or_admin" on public.payment_request_line_items
  for update using (
    exists (
      select 1 from public.payment_requests pr
      where pr.id = payment_request_line_items.payment_request_id
        and (pr.requested_by = auth.uid() or public.is_admin())
    )
  );

drop policy if exists "payment_request_line_items_delete_authenticated" on public.payment_request_line_items;
create policy "payment_request_line_items_delete_owner_or_admin" on public.payment_request_line_items
  for delete using (
    exists (
      select 1 from public.payment_requests pr
      where pr.id = payment_request_line_items.payment_request_id
        and (pr.requested_by = auth.uid() or public.is_admin())
    )
  );

drop policy if exists "payment_request_receipts_delete_authenticated" on public.payment_request_receipts;
create policy "payment_request_receipts_delete_owner_or_admin" on public.payment_request_receipts
  for delete using (
    exists (
      select 1 from public.payment_requests pr
      where pr.id = payment_request_receipts.payment_request_id
        and (pr.requested_by = auth.uid() or public.is_admin())
    )
  );

-- payment_request_receipts는 애초에 update 정책이 하나도 없었다 — RLS는
-- "정책이 없으면 그 명령은 거부"라서, 영수증 순서 바꾸기
-- (reorderPaymentRequestReceipts가 sort_order를 update)가 지금까지도
-- 에러 없이 조용히 0건 갱신으로 실패하고 있었을 가능성이 높다. 이번에
-- 같은 조건(작성자 또는 관리자)으로 update 정책을 새로 추가해서 이 기능이
-- 실제로 동작하게 한다.
create policy "payment_request_receipts_update_owner_or_admin" on public.payment_request_receipts
  for update using (
    exists (
      select 1 from public.payment_requests pr
      where pr.id = payment_request_receipts.payment_request_id
        and (pr.requested_by = auth.uid() or public.is_admin())
    )
  );

-- payment-receipts 스토리지 버킷의 DELETE도 지금까지는 "로그인만 하면 누구나
-- 삭제 가능"이었다(messenger-attachments는 이미 소유자 전용으로 고쳐져
-- 있었는데 payment-receipts엔 같은 패치가 빠져 있었다). 파일 경로에는
-- 업로더의 uuid가 없어서(결의서id/타임스탬프-uuid.jpg 구조) 곧바로
-- 소유자를 비교할 수 없으니, payment_request_receipts에 저장된
-- file_path로 그 파일이 속한 지급결의서를 찾아 같은 기준(작성자 또는
-- 관리자)으로 판정한다.
drop policy if exists "payment_receipts_authenticated_delete" on storage.objects;
create policy "payment_receipts_owner_or_admin_delete" on storage.objects
  for delete using (
    bucket_id = 'payment-receipts'
    and exists (
      select 1
      from public.payment_request_receipts prr
      join public.payment_requests pr on pr.id = prr.payment_request_id
      where prr.file_path = storage.objects.name
        and (pr.requested_by = auth.uid() or public.is_admin())
    )
  );
