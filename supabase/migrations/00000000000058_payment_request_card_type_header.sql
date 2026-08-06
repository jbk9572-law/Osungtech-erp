-- 사용카드는 사용 내역 한 줄 한 줄이 아니라 문서(지급결의서) 전체에 하나만
-- 붙는다 — 신한법인카드 쓴 내역은 신한 문서에만, 하나법인카드는 하나
-- 문서에만, 개인카드는 개인카드 문서에만 몰아서 작성하는 실제 방식이라
-- 그렇다. migration 57에서 줄(payment_request_line_items)마다 선택하게
-- 만든 건 잘못된 설계였어서 헤더(payment_requests)로 옮긴다. 카드 종류도
-- "법인카드"가 아니라 실제 두 회사 이름 그대로 하나법인카드/신한법인카드로
-- 바로잡는다.
alter table public.payment_requests
  add column if not exists card_type text not null default '개인카드'
    check (card_type in ('개인카드', '하나법인카드', '신한법인카드'));

alter table public.payment_request_line_items drop column if exists card_type;

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
      (payment_request_id, used_at, vendor, purpose, amount, remark, sort_order)
    select
      v_id,
      (item->>'usedAt')::date,
      item->>'vendor',
      nullif(item->>'purpose', ''),
      (item->>'amount')::numeric,
      nullif(item->>'remark', ''),
      (item->>'sortOrder')::int
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
      (payment_request_id, used_at, vendor, purpose, amount, remark, sort_order)
    select
      p_id,
      (item->>'usedAt')::date,
      item->>'vendor',
      nullif(item->>'purpose', ''),
      (item->>'amount')::numeric,
      nullif(item->>'remark', ''),
      (item->>'sortOrder')::int
    from jsonb_array_elements(p_items) as item;
  end if;

  return p_id;
end;
$$;
