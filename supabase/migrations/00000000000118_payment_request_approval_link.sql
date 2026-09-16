-- 지급결의양식을 "월말 마감 시 결재선 지정" 방식으로 전자결재에
-- 연동한다. 이 문서는 leave_requests와 달리 한 달 내내 여러 번에 걸쳐
-- 한 줄씩 채워지는 진행형 장부라(오늘 지출 빠르게 기록), 문서를 처음
-- 만드는 시점에 결재선부터 정하게 하면 지금 쓰는 방식이 깨진다. 대신
-- 평소엔 지금처럼 자유롭게 작성하다가(status='draft'), 다 쓰고 나서
-- "제출(마감)" 버튼을 누르는 시점에만 결재선을 지정하게 한다 — 그
-- 순간부터 문서가 잠기고(더 이상 줄 추가/수정 불가) 결재를 거친다.
alter table public.payment_requests
  add column if not exists status text not null default 'draft' check (status in ('draft', 'pending', 'approved', 'rejected')),
  add column if not exists approval_document_id uuid references public.approval_documents (id) on delete set null,
  add column if not exists decided_at timestamptz,
  add column if not exists decided_by uuid references public.profiles (id) on delete set null;

create index if not exists payment_requests_approval_document_id_idx on public.payment_requests (approval_document_id);

-- 이번 달 버킷이 이미 제출(마감)됐으면 더 이상 그 문서에 이어 쓸 수
-- 없다 — 계속 쓰고 싶다면 그 문서를 회수(recall)해서 다시 열거나,
-- 다음 달 문서로 넘어가야 한다. 조용히 넘어가면 "분명 오늘 등록했는데
-- 다음 결재에 안 보인다" 같은 혼란이 생기므로 명확히 에러로 알린다.
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
  v_status text;
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
    select id, status into v_id, v_status
    from public.payment_requests
    where department = p_department and card_type = p_card_type and month_key = p_month_key
      and requested_by is not distinct from p_requested_by;

    if v_status is distinct from 'draft' then
      raise exception '이번 달 지급결의서는 이미 제출(마감)되어 더 이상 추가할 수 없습니다. 필요하면 결재 문서를 회수한 뒤 다시 작성해주세요.';
    end if;
  end if;

  return v_id;
end;
$$;

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
  v_next integer;
  v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext(p_payment_request_id::text));

  select status into v_status from public.payment_requests where id = p_payment_request_id;
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
  v_status text;
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;

  select requested_by, status into v_owner, v_status from public.payment_requests where id = p_id;
  if not found then
    raise exception '지급결의서를 찾을 수 없습니다.';
  end if;
  if v_owner is distinct from v_actor and not public.is_admin() then
    raise exception '본인이 작성한 지급결의서만 수정할 수 있습니다.';
  end if;
  if v_status is distinct from 'draft' then
    raise exception '이미 제출(마감)된 지급결의서는 수정할 수 없습니다.';
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

-- 지급결의서 제출(마감) — 다 쓴 문서에 결재선을 붙여 잠그고 결재를
-- 시작한다. 사용 내역이 하나도 없는 빈 문서는 제출할 수 없다.
create or replace function public.submit_payment_request(
  p_id uuid,
  p_approver_ids uuid[],
  p_reference_ids uuid[] default '{}'
)
returns uuid
language plpgsql
as $$
declare
  v_actor uuid := auth.uid();
  v_owner uuid;
  v_status text;
  v_department text;
  v_card_type text;
  v_period_from date;
  v_item_count integer;
  v_total numeric;
  v_doc_id uuid;
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;
  if p_approver_ids is null or array_length(p_approver_ids, 1) is null then
    raise exception '결재선(승인자)을 1명 이상 지정해주세요.';
  end if;

  select requested_by, status, department, card_type, period_from
    into v_owner, v_status, v_department, v_card_type, v_period_from
  from public.payment_requests where id = p_id;

  if v_owner is null then
    raise exception '지급결의서를 찾을 수 없습니다.';
  end if;
  if v_owner is distinct from v_actor and not public.is_admin() then
    raise exception '본인이 작성한 지급결의서만 제출할 수 있습니다.';
  end if;
  if v_status is distinct from 'draft' then
    raise exception '임시 작성 상태의 지급결의서만 제출할 수 있습니다.';
  end if;

  select count(*), coalesce(sum(amount), 0) into v_item_count, v_total
  from public.payment_request_line_items where payment_request_id = p_id;
  if v_item_count = 0 then
    raise exception '사용 내역이 없는 지급결의서는 제출할 수 없습니다.';
  end if;

  v_doc_id := public.submit_approval_document(
    coalesce(v_department, '부서미지정') || ' · ' || coalesce(v_card_type, '') || ' · '
      || to_char(coalesce(v_period_from, current_date), 'YYYY-MM') || ' 지급결의서 (' || v_total || '원)',
    '사용 내역 ' || v_item_count || '건, 합계 ' || v_total || '원',
    p_approver_ids,
    p_reference_ids
  );

  update public.payment_requests
  set status = 'pending', approval_document_id = v_doc_id
  where id = p_id;

  return v_doc_id;
end;
$$;

-- 제출을 회수한다 — 아직 아무도 결재하지 않은 경우에만(recall_approval_document가
-- 검증) 허용하고, 회수되면 다시 draft로 돌아가 계속 작성할 수 있다.
create or replace function public.recall_payment_request(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_owner uuid;
  v_status text;
  v_doc_id uuid;
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;

  select requested_by, status, approval_document_id into v_owner, v_status, v_doc_id
  from public.payment_requests where id = p_id;

  if v_owner is null then
    raise exception '지급결의서를 찾을 수 없습니다.';
  end if;
  if v_owner is distinct from v_actor and not public.is_admin() then
    raise exception '본인이 작성한 지급결의서만 회수할 수 있습니다.';
  end if;
  if v_status is distinct from 'pending' then
    raise exception '제출된 상태의 지급결의서만 회수할 수 있습니다.';
  end if;

  if v_doc_id is not null then
    perform public.recall_approval_document(v_doc_id);
  end if;

  update public.payment_requests set status = 'draft', approval_document_id = null where id = p_id;
end;
$$;

revoke all on function public.submit_payment_request(uuid, uuid[], uuid[]) from public;
grant execute on function public.submit_payment_request(uuid, uuid[], uuid[]) to authenticated;
revoke all on function public.recall_payment_request(uuid) from public;
grant execute on function public.recall_payment_request(uuid) to authenticated;

-- 결재가 끝나면 지급결의서 상태에도 그대로 반영한다.
create or replace function public.sync_payment_request_from_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_decided_by uuid;
begin
  if new.status not in ('approved', 'rejected') or new.status = old.status then
    return new;
  end if;

  select decided_by into v_decided_by
  from public.approval_steps
  where document_id = new.id and role = 'approver' and decided_by is not null
  order by step_order desc
  limit 1;

  update public.payment_requests
  set status = new.status, decided_at = new.decided_at, decided_by = v_decided_by
  where approval_document_id = new.id and status = 'pending';

  return new;
end;
$$;

drop trigger if exists sync_payment_request_from_approval_trigger on public.approval_documents;
create trigger sync_payment_request_from_approval_trigger
  after update on public.approval_documents
  for each row execute procedure public.sync_payment_request_from_approval();
