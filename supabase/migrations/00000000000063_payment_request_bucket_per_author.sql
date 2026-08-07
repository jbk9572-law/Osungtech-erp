-- migration 62의 빠른입력 문서 버킷을 "부서+카드종류+월"로만 나눴더니,
-- 개인카드는 회사 공용 카드가 아니라 각자 것이라서 두 사람이 입력하면
-- 같은 개인카드 문서에 섞여버리는 문제가 있었다. 지급결의서는 결국
-- "그 사람이 쓴 걸 그 사람이 청구하는" 문서이므로, 작성자(requested_by)도
-- 버킷 조건에 포함시켜 사람별로 항상 따로 나뉘게 한다.
--
-- 기존 unique 제약(department, card_type, month_key)이 이미 그 3개
-- 조합당 문서를 최대 1개로 막고 있었으므로, requested_by를 추가해도
-- 기존 데이터끼리 새로 충돌할 일은 없다(제약을 완화하는 방향이라 항상
-- 안전하게 적용된다).
alter table public.payment_requests
  drop constraint if exists payment_requests_dept_card_month_key_key;
alter table public.payment_requests
  add constraint payment_requests_dept_card_month_key_key unique (department, card_type, month_key, requested_by);

create or replace function public.find_or_create_payment_request_bucket(
  p_department text,
  p_card_type text,
  p_month_key text,
  p_requested_by uuid
)
returns uuid
language plpgsql
as $$
declare
  v_id uuid;
  v_period_from date;
  v_period_to date;
begin
  v_period_from := (p_month_key || '-01')::date;
  v_period_to := (v_period_from + interval '1 month - 1 day')::date;

  insert into public.payment_requests (department, period_from, period_to, card_type, requested_by, month_key)
  values (p_department, v_period_from, v_period_to, p_card_type, p_requested_by, p_month_key)
  on conflict (department, card_type, month_key, requested_by) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id
    from public.payment_requests
    where department = p_department and card_type = p_card_type and month_key = p_month_key
      and requested_by is not distinct from p_requested_by;
  end if;

  return v_id;
end;
$$;
