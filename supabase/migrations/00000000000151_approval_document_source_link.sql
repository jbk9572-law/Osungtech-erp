-- 결재문서(approval_documents)에서 원본 레코드로 가는 링크가 없었다 —
-- 전체 감사에서 발견. 연차 신청/구매요청/근태 정정/지급결의서/공문은
-- 전부 "원본 → approval_document_id" 방향으로만 링크를 저장하고
-- (leave_requests.approval_document_id 등), approval_documents 쪽엔
-- 반대 방향 링크가 아예 없어서, 기안함/결재 상세 화면(approvals/[id])에
-- 들어온 결재자가 방금 제출된 텍스트(title/content)만 볼 뿐, 그 뒤에
-- 있는 실제 연차 신청/구매요청 화면으로 바로 들어갈 방법이 없었다.
--
-- source_type/source_id를 추가해서 역방향 링크를 남긴다. 제출
-- RPC(submit_leave_request 등)가 이미 원본 레코드를 만들 때 그 id를
-- 알고 있으므로, 같은 트랜잭션 안에서 approval_documents도 한 번 더
-- update한다.
alter table public.approval_documents add column if not exists source_type text;
alter table public.approval_documents add column if not exists source_id uuid;

create index if not exists approval_documents_source_idx
  on public.approval_documents (source_type, source_id);

-- ── 연차 신청 ──────────────────────────────────────────────────
create or replace function public.submit_leave_request(
  p_start_date date,
  p_end_date date,
  p_days numeric,
  p_reason text,
  p_approver_ids uuid[],
  p_reference_ids uuid[] default '{}',
  p_leave_unit text default 'full'
)
returns uuid
language plpgsql
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_name text;
  v_leave_id uuid;
  v_doc_id uuid;
  v_unit_label text;
  v_year integer := extract(year from p_start_date)::int;
  v_total_days numeric;
  v_used_days numeric;
  v_remaining numeric;
  v_balance_note text;
  v_content text;
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;
  if p_end_date < p_start_date then
    raise exception '종료일이 시작일보다 빠를 수 없습니다.';
  end if;
  if p_days is null or p_days <= 0 then
    raise exception '사용 일수를 올바르게 입력해주세요.';
  end if;
  if p_leave_unit not in ('full', 'half_am', 'half_pm', 'quarter_am', 'quarter_pm') then
    raise exception '잘못된 휴가 단위입니다.';
  end if;
  if p_leave_unit <> 'full' and p_start_date <> p_end_date then
    raise exception '반차/반반차는 하루만 신청할 수 있습니다.';
  end if;
  if p_approver_ids is null or array_length(p_approver_ids, 1) is null then
    raise exception '결재선(승인자)을 1명 이상 지정해주세요.';
  end if;

  select full_name into v_actor_name from public.profiles where id = v_actor;

  select total_days into v_total_days from public.leave_balances where user_id = v_actor and year = v_year;
  select coalesce(sum(days), 0) into v_used_days
  from public.leave_requests
  where user_id = v_actor and status = 'approved'
    and start_date >= make_date(v_year, 1, 1) and start_date <= make_date(v_year, 12, 31);
  v_remaining := coalesce(v_total_days, 0) - v_used_days;
  v_balance_note := format(
    '[잔여 연차 안내] %s년 총 %s일 중 %s일 사용, 이번 신청(%s일) 전 잔여 %s일 → 신청 후 %s일%s',
    v_year, coalesce(v_total_days, 0), v_used_days, p_days, v_remaining, v_remaining - p_days,
    case when v_remaining - p_days < 0 then ' — 잔여를 초과하는 신청입니다.' else '' end
  );

  v_unit_label := case p_leave_unit
    when 'half_am' then ' (오전반차)'
    when 'half_pm' then ' (오후반차)'
    when 'quarter_am' then ' (오전반반차)'
    when 'quarter_pm' then ' (오후반반차)'
    else ''
  end;

  v_content := v_balance_note || E'\n\n' || coalesce(p_reason, '');

  v_doc_id := public.submit_approval_document(
    coalesce(v_actor_name, '구성원') || '의 연차 신청 (' || p_start_date || ' ~ ' || p_end_date || ', ' || p_days || '일)' || v_unit_label,
    v_content,
    p_approver_ids,
    p_reference_ids
  );

  insert into public.leave_requests (user_id, start_date, end_date, days, reason, approval_document_id, leave_unit)
  values (v_actor, p_start_date, p_end_date, p_days, p_reason, v_doc_id, p_leave_unit)
  returning id into v_leave_id;

  update public.approval_documents set source_type = 'leave_request', source_id = v_leave_id where id = v_doc_id;

  return v_leave_id;
end;
$$;

revoke all on function public.submit_leave_request(date, date, numeric, text, uuid[], uuid[], text) from public;
grant execute on function public.submit_leave_request(date, date, numeric, text, uuid[], uuid[], text) to authenticated;

-- ── 근태 정정 ──────────────────────────────────────────────────
create or replace function public.submit_attendance_correction(
  p_work_date date,
  p_requested_clock_in_at timestamptz,
  p_requested_clock_out_at timestamptz,
  p_reason text,
  p_approver_ids uuid[],
  p_reference_ids uuid[] default '{}'
)
returns uuid
language plpgsql
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_name text;
  v_request_id uuid;
  v_doc_id uuid;
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;
  if p_requested_clock_in_at is null and p_requested_clock_out_at is null then
    raise exception '정정할 출근 또는 퇴근 시간을 하나 이상 입력해주세요.';
  end if;
  if p_reason is null or trim(p_reason) = '' then
    raise exception '정정 사유를 입력해주세요.';
  end if;
  if p_approver_ids is null or array_length(p_approver_ids, 1) is null then
    raise exception '결재선(승인자)을 1명 이상 지정해주세요.';
  end if;

  select full_name into v_actor_name from public.profiles where id = v_actor;

  v_doc_id := public.submit_approval_document(
    coalesce(v_actor_name, '구성원') || '의 근태 정정 신청 (' || p_work_date || ')',
    p_reason,
    p_approver_ids,
    p_reference_ids
  );

  insert into public.attendance_correction_requests
    (user_id, work_date, requested_clock_in_at, requested_clock_out_at, reason, approval_document_id)
  values (v_actor, p_work_date, p_requested_clock_in_at, p_requested_clock_out_at, p_reason, v_doc_id)
  returning id into v_request_id;

  update public.approval_documents set source_type = 'attendance_correction', source_id = v_request_id where id = v_doc_id;

  return v_request_id;
end;
$$;

revoke all on function public.submit_attendance_correction(date, timestamptz, timestamptz, text, uuid[], uuid[]) from public;
grant execute on function public.submit_attendance_correction(date, timestamptz, timestamptz, text, uuid[], uuid[]) to authenticated;

-- ── 구매요청 ───────────────────────────────────────────────────
create or replace function public.submit_purchase_request(
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
  v_supplier_name text;
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

  select pr.requested_by, pr.status, s.name
    into v_owner, v_status, v_supplier_name
  from public.purchase_requests pr
  join public.suppliers s on s.id = pr.supplier_id
  where pr.id = p_id;

  if v_owner is null then
    raise exception '구매요청을 찾을 수 없습니다.';
  end if;
  if v_owner is distinct from v_actor and not public.is_admin() then
    raise exception '본인이 작성한 구매요청만 제출할 수 있습니다.';
  end if;
  if v_status is distinct from 'draft' then
    raise exception '임시 작성 상태의 구매요청만 제출할 수 있습니다.';
  end if;

  select count(*), coalesce(sum(quantity * estimated_unit_price), 0) into v_item_count, v_total
  from public.purchase_request_items where purchase_request_id = p_id;
  if v_item_count = 0 then
    raise exception '품목이 없는 구매요청은 제출할 수 없습니다.';
  end if;

  v_doc_id := public.submit_approval_document(
    coalesce(v_supplier_name, '공급처미지정') || ' 구매요청 (예상 ' || v_total || '원)',
    '품목 ' || v_item_count || '건, 예상 합계 ' || v_total || '원',
    p_approver_ids,
    p_reference_ids
  );

  update public.purchase_requests
  set status = 'pending', approval_document_id = v_doc_id
  where id = p_id;

  update public.approval_documents set source_type = 'purchase_request', source_id = p_id where id = v_doc_id;

  return v_doc_id;
end;
$$;

-- ── 지급결의서 ─────────────────────────────────────────────────
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

  update public.approval_documents set source_type = 'payment_request', source_id = p_id where id = v_doc_id;

  return v_doc_id;
end;
$$;

-- ── 공문 상신 ──────────────────────────────────────────────────
create or replace function public.submit_official_document(
  p_official_document_id uuid,
  p_approver_ids uuid[],
  p_reference_ids uuid[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_doc record;
  v_recipient_count integer;
  v_approval_doc_id uuid;
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;
  if p_approver_ids is null or array_length(p_approver_ids, 1) is null then
    raise exception '결재선(승인자)을 1명 이상 지정해주세요.';
  end if;

  select * into v_doc from public.official_documents where id = p_official_document_id;
  if v_doc.id is null then
    raise exception '공문을 찾을 수 없습니다.';
  end if;
  if v_doc.created_by <> v_actor then
    raise exception '본인이 작성한 공문만 상신할 수 있습니다.';
  end if;
  if v_doc.status <> 'draft' then
    raise exception '작성중 상태의 공문만 상신할 수 있습니다.';
  end if;

  if not v_doc.internal_only then
    select count(*) into v_recipient_count
    from public.official_document_recipients where official_document_id = p_official_document_id;
    if v_recipient_count = 0 then
      raise exception '수신처를 1곳 이상 지정해주세요.';
    end if;
  end if;

  v_approval_doc_id := public.submit_approval_document(
    '[공문] ' || v_doc.title,
    v_doc.body,
    p_approver_ids,
    p_reference_ids
  );

  update public.official_documents
  set status = 'pending_approval', approval_document_id = v_approval_doc_id
  where id = p_official_document_id;

  update public.approval_documents set source_type = 'official_document', source_id = p_official_document_id where id = v_approval_doc_id;

  return v_approval_doc_id;
end;
$$;
