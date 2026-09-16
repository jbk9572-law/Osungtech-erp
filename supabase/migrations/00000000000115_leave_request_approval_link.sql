-- 휴가 신청을 전자결재 결재선에 태운다. 지금까지는 "관리자 아무나"가
-- 승인/반려하는 별도의 단순 플로우였는데, 이번에 만든 조직도 기반
-- 결재선/전결권/공유 결재선 인프라를 그대로 재사용해 다른 기안서와
-- 똑같은 절차(순서대로 결재, 전결권 위임 가능, 참조자 지정 가능)를
-- 타게 한다 — 관련 화면끼리 끊겨 있던 부분을 잇는다.
alter table public.leave_requests add column if not exists approval_document_id uuid references public.approval_documents (id) on delete set null;

create index if not exists leave_requests_approval_document_id_idx on public.leave_requests (approval_document_id);

-- 휴가 신청 + 결재선을 원자적으로 만든다(submit_approval_document과 같은
-- 이유 — 결재선 없는 반쪽 신청이 안 남게). submit_approval_document이
-- insert 권한(authenticated)만으로 이미 동작하므로 이 함수도 별도
-- security definer 없이 호출자 권한 그대로 동작한다.
create or replace function public.submit_leave_request(
  p_start_date date,
  p_end_date date,
  p_days numeric,
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
  v_leave_id uuid;
  v_doc_id uuid;
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
  if p_approver_ids is null or array_length(p_approver_ids, 1) is null then
    raise exception '결재선(승인자)을 1명 이상 지정해주세요.';
  end if;

  select full_name into v_actor_name from public.profiles where id = v_actor;

  v_doc_id := public.submit_approval_document(
    coalesce(v_actor_name, '구성원') || '의 연차 신청 (' || p_start_date || ' ~ ' || p_end_date || ', ' || p_days || '일)',
    coalesce(p_reason, ''),
    p_approver_ids,
    p_reference_ids
  );

  insert into public.leave_requests (user_id, start_date, end_date, days, reason, approval_document_id)
  values (v_actor, p_start_date, p_end_date, p_days, p_reason, v_doc_id)
  returning id into v_leave_id;

  return v_leave_id;
end;
$$;

revoke all on function public.submit_leave_request(date, date, numeric, text, uuid[], uuid[]) from public;
grant execute on function public.submit_leave_request(date, date, numeric, text, uuid[], uuid[]) to authenticated;

-- 결재 문서가 승인/반려로 끝나면 연결된 휴가 신청 상태에도 그대로
-- 반영한다. decide_approval_step()이 이미 security definer라 이 트리거도
-- 같은 문맥에서 실행되지만, 결재자가 반드시 관리자는 아니므로(전결권
-- 위임자 포함) leave_requests의 관리자 전용 update 정책을 우회할 수
-- 있게 트리거 함수 자체도 security definer로 선언한다.
create or replace function public.sync_leave_request_from_approval()
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

  update public.leave_requests
  set status = new.status, decided_at = new.decided_at, decided_by = v_decided_by
  where approval_document_id = new.id and status = 'pending';

  return new;
end;
$$;

drop trigger if exists sync_leave_request_from_approval_trigger on public.approval_documents;
create trigger sync_leave_request_from_approval_trigger
  after update on public.approval_documents
  for each row execute procedure public.sync_leave_request_from_approval();
