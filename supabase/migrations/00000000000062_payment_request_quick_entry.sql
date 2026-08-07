-- 지급결의서를 월말에 한꺼번에 몰아 쓰는 대신 그날그날 한 줄씩 빠르게
-- 기록할 수 있게 한다. month_key("YYYY-MM")를 채워서 만든 문서는 그
-- 부서+카드종류+월 조합의 "버킷" 역할을 한다 — 같은 조합으로 다시
-- 빠른입력을 하면 새 문서를 만들지 않고 이 문서에 줄만 추가한다.
--
-- 기존처럼 "새로 만들기" 폼으로 직접 만든 문서는 month_key를 안 채우므로
-- (임의 기간을 쓸 수 있어야 해서) 이 제약과 무관하다 — Postgres unique
-- 제약은 NULL끼리는 서로 겹친 것으로 안 보므로, month_key가 null인
-- 문서끼리는 여러 개 있어도 문제없다.
alter table public.payment_requests add column if not exists month_key text;

alter table public.payment_requests
  drop constraint if exists payment_requests_dept_card_month_key_key;
alter table public.payment_requests
  add constraint payment_requests_dept_card_month_key_key unique (department, card_type, month_key);

-- 두 사람이 같은 부서+카드로 거의 동시에 첫 빠른입력을 하면, "문서가
-- 있는지 확인 후 없으면 생성"을 앱 코드에서 두 단계로 하면 그 사이에
-- 둘 다 "없음"을 보고 문서를 하나씩 만들어버려 같은 달에 문서가 2개로
-- 갈라질 수 있다. insert ... on conflict do nothing로 원자적으로
-- 처리해서, 먼저 만든 쪽만 살아남고 나중 요청은 그 문서를 그대로
-- 찾아서 쓰게 한다.
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
  on conflict (department, card_type, month_key) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id
    from public.payment_requests
    where department = p_department and card_type = p_card_type and month_key = p_month_key;
  end if;

  return v_id;
end;
$$;
