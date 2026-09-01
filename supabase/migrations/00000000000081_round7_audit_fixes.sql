-- 7차 정기 감사에서 확인된 것을 고친다.
--
-- payment_request_line_items/payment_request_receipts에 새 행을 추가할 때
-- "그 문서의 마지막 sort_order를 조회 → +1해서 삽입"을 서버 액션에서 각각
-- 따로 했는데, 이 둘 사이에 락이 없어서 같은 문서(같은 부서+카드+월
-- 버킷)에 동시에 지출을 등록하면(다른 직원이 동시에, 또는 같은 사람이
-- 탭 두 개로) 두 요청이 같은 "마지막 순번"을 읽고 똑같은 sort_order로
-- 저장될 수 있었다 — 스테이플러로 순서를 고정해두는 기능의 취지가
-- 깨진다. 같은 문서(payment_request_id) 단위로 advisory lock을 걸어
-- "다음 순번 조회 + 삽입"을 한 함수 안에서 원자적으로 처리한다.
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
  v_next integer;
  v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext(p_payment_request_id::text));

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

revoke all on function public.insert_payment_request_line_item(uuid, date, text, text, numeric, text, boolean) from public;
grant execute on function public.insert_payment_request_line_item(uuid, date, text, text, numeric, text, boolean) to authenticated;

create or replace function public.insert_payment_request_receipt(
  p_payment_request_id uuid,
  p_file_path text,
  p_file_url text,
  p_created_by uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next integer;
  v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext(p_payment_request_id::text));

  select coalesce(max(sort_order), -1) + 1
    into v_next
    from public.payment_request_receipts
    where payment_request_id = p_payment_request_id;

  insert into public.payment_request_receipts
    (payment_request_id, file_path, file_url, sort_order, created_by)
  values
    (p_payment_request_id, p_file_path, p_file_url, v_next, p_created_by)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.insert_payment_request_receipt(uuid, text, text, uuid) from public;
grant execute on function public.insert_payment_request_receipt(uuid, text, text, uuid) to authenticated;
