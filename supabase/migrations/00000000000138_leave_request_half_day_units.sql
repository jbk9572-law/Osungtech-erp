-- 연차 신청을 종일 단위로만 받을 수 있었다(days 입력칸 자체는 0.5 단위
-- 숫자를 받을 수 있었지만, "반차"라는 개념 자체가 화면에 없어서 실제로는
-- 아무도 그렇게 안 썼다). 반차(오전/오후)·반반차(오전/오후) 네 가지를
-- 명시적으로 고를 수 있게 leave_unit을 추가한다. 잔여일수 계산은
-- 이미 leave_requests.days(숫자, 0.5/0.25 허용)를 그대로 합산하는
-- 방식이라 스키마 변경 없이도 정확히 동작한다 — 이 컬럼은 화면 표시와
-- "반차/반반차는 하루만 선택 가능" 검증에만 쓴다.

alter table public.leave_requests
  add column if not exists leave_unit text not null default 'full'
  check (leave_unit in ('full', 'half_am', 'half_pm', 'quarter_am', 'quarter_pm'));

-- 반차/반반차는 시작일=종료일(하루)이어야 의미가 있다.
alter table public.leave_requests
  add constraint leave_requests_half_unit_single_day
  check (leave_unit = 'full' or start_date = end_date);

drop function if exists public.submit_leave_request(date, date, numeric, text, uuid[], uuid[]);

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

  v_unit_label := case p_leave_unit
    when 'half_am' then ' (오전반차)'
    when 'half_pm' then ' (오후반차)'
    when 'quarter_am' then ' (오전반반차)'
    when 'quarter_pm' then ' (오후반반차)'
    else ''
  end;

  v_doc_id := public.submit_approval_document(
    coalesce(v_actor_name, '구성원') || '의 연차 신청 (' || p_start_date || ' ~ ' || p_end_date || ', ' || p_days || '일)' || v_unit_label,
    coalesce(p_reason, ''),
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
