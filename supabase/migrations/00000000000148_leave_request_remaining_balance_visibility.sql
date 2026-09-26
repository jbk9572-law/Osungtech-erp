-- 연차 신청 시 잔여일수 초과 여부를 어디서도 확인할 방법이 없던 문제 —
-- 전체 감사에서 발견. 신청자 본인 화면(hr/attendance)에는 이미 "잔여"
-- KPI가 떠 있지만, 정작 승인/반려를 결정하는 결재자는 기안함/결재
-- 상세 화면에서 신청자의 잔여 연차를 알 방법이 전혀 없어 초과 신청도
-- 그대로 승인될 수 있었다.
--
-- migration 105의 설계 원칙(연차 발생 규칙을 코드로 자동 계산/강제하지
-- 않는다 — 그 자체가 법적으로 정확해야 하는 영역이라 회사가 직접 정한
-- leave_balances.total_days를 그대로 믿는다)은 그대로 지킨다. 그래서
-- 신청 자체를 막는 하드 블록은 넣지 않고, hr/leave-balances 화면과
-- 완전히 같은 단순 산수(총일수 - 그 해 승인된 일수)로 잔여를 계산해
-- 결재 문서 본문에 그대로 적어 넣기만 한다 — 결재자가 최소한 그 숫자를
-- 보고 판단할 수 있게.
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

  -- hr/leave-balances 화면과 동일한 계산(총일수 - 그 해 승인된 일수) —
  -- RLS상 본인 leave_balances/leave_requests는 어차피 조회 가능한
  -- 값이라 여기서 새로 권한을 여는 게 아니다.
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

  return v_leave_id;
end;
$$;

revoke all on function public.submit_leave_request(date, date, numeric, text, uuid[], uuid[], text) from public;
grant execute on function public.submit_leave_request(date, date, numeric, text, uuid[], uuid[], text) to authenticated;
