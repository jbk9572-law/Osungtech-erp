-- 지급결의서를 자유 서식(제목+본문)에서 회사 실제 "사용내역" 양식으로
-- 구조화한다: 부서명/기간 + 일자/사용처/용도/금액/사용카드/비고 줄이
-- 여러 개인 표. 기존 title/content 컬럼은 혹시 예전 방식으로 이미
-- 작성된 문서가 있을 수 있어 그대로 두고(하위호환), 새 항목부터는
-- department/period_from/period_to + payment_request_line_items로 관리한다.
alter table public.payment_requests
  add column if not exists department text,
  add column if not exists period_from date,
  add column if not exists period_to date;

alter table public.payment_requests alter column title drop not null;

create table if not exists public.payment_request_line_items (
  id uuid primary key default gen_random_uuid(),
  payment_request_id uuid not null references public.payment_requests (id) on delete cascade,
  used_at date not null,
  vendor text not null,
  purpose text,
  amount numeric(14, 2) not null default 0,
  -- 회사에서 실제 쓰는 카드가 개인카드/법인카드/신한법인카드 세 가지라 고정
  -- 목록으로 제한한다(document_type 등 다른 곳과 동일한 방식).
  card_type text not null default '개인카드' check (card_type in ('개인카드', '법인카드', '신한법인카드')),
  remark text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists payment_request_line_items_payment_request_id_idx
  on public.payment_request_line_items (payment_request_id);

alter table public.payment_request_line_items enable row level security;

drop policy if exists "payment_request_line_items_select_authenticated" on public.payment_request_line_items;
create policy "payment_request_line_items_select_authenticated" on public.payment_request_line_items
  for select using (auth.role() = 'authenticated');
drop policy if exists "payment_request_line_items_insert_authenticated" on public.payment_request_line_items;
create policy "payment_request_line_items_insert_authenticated" on public.payment_request_line_items
  for insert with check (auth.role() = 'authenticated');
drop policy if exists "payment_request_line_items_update_authenticated" on public.payment_request_line_items;
create policy "payment_request_line_items_update_authenticated" on public.payment_request_line_items
  for update using (auth.role() = 'authenticated');
drop policy if exists "payment_request_line_items_delete_authenticated" on public.payment_request_line_items;
create policy "payment_request_line_items_delete_authenticated" on public.payment_request_line_items
  for delete using (auth.role() = 'authenticated');

-- 헤더(payment_requests) + 줄(line_items) 생성/수정을 한 번에 묶어 원자적으로
-- 처리한다 — 이 세션에서 매출/매입에 적용한 것과 같은 이유로, 헤더만
-- 만들어지고 줄 삽입이 실패하면 품목 없는 빈 문서가 남는 불일치를 막는다.
create or replace function public.create_payment_request_with_items(
  p_department text,
  p_period_from date,
  p_period_to date,
  p_requested_by uuid,
  p_items jsonb
)
returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  insert into public.payment_requests (department, period_from, period_to, requested_by)
  values (p_department, p_period_from, p_period_to, p_requested_by)
  returning id into v_id;

  if jsonb_array_length(p_items) > 0 then
    insert into public.payment_request_line_items
      (payment_request_id, used_at, vendor, purpose, amount, card_type, remark, sort_order)
    select
      v_id,
      (item->>'usedAt')::date,
      item->>'vendor',
      nullif(item->>'purpose', ''),
      (item->>'amount')::numeric,
      coalesce(nullif(item->>'cardType', ''), '개인카드'),
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
  p_items jsonb
)
returns uuid
language plpgsql
as $$
begin
  update public.payment_requests
  set department = p_department, period_from = p_period_from, period_to = p_period_to
  where id = p_id;

  delete from public.payment_request_line_items where payment_request_id = p_id;

  if jsonb_array_length(p_items) > 0 then
    insert into public.payment_request_line_items
      (payment_request_id, used_at, vendor, purpose, amount, card_type, remark, sort_order)
    select
      p_id,
      (item->>'usedAt')::date,
      item->>'vendor',
      nullif(item->>'purpose', ''),
      (item->>'amount')::numeric,
      coalesce(nullif(item->>'cardType', ''), '개인카드'),
      nullif(item->>'remark', ''),
      (item->>'sortOrder')::int
    from jsonb_array_elements(p_items) as item;
  end if;

  return p_id;
end;
$$;
