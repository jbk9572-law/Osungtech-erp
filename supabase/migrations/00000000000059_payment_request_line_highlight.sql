-- 지급결의서(사용내역) 줄 중 특정 건을 인쇄 시 강조(음영 처리) 표시할 수
-- 있도록 is_highlighted 플래그를 추가한다. 실물 서류에 형광펜으로 특정
-- 지출 항목을 표시해두던 것을 인쇄본에 그대로 재현하기 위함.
alter table public.payment_request_line_items
  add column if not exists is_highlighted boolean not null default false;

create or replace function public.create_payment_request_with_items(
  p_department text,
  p_period_from date,
  p_period_to date,
  p_card_type text,
  p_requested_by uuid,
  p_items jsonb
)
returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  insert into public.payment_requests (department, period_from, period_to, card_type, requested_by)
  values (p_department, p_period_from, p_period_to, coalesce(nullif(p_card_type, ''), '개인카드'), p_requested_by)
  returning id into v_id;

  if jsonb_array_length(p_items) > 0 then
    insert into public.payment_request_line_items
      (payment_request_id, used_at, vendor, purpose, amount, remark, sort_order, is_highlighted)
    select
      v_id,
      (item->>'usedAt')::date,
      item->>'vendor',
      nullif(item->>'purpose', ''),
      (item->>'amount')::numeric,
      nullif(item->>'remark', ''),
      (item->>'sortOrder')::int,
      coalesce((item->>'isHighlighted')::boolean, false)
    from jsonb_array_elements(p_items) as item;
  end if;

  return v_id;
end;
$$;

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
begin
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
