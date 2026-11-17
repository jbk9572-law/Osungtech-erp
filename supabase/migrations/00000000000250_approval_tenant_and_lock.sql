-- 결재 처리 함수 점검(동시 접속·모의침투 관점) 결과 수정.
--
--  1) decide_approval_step / recall_approval_document 는 권한을 우회하는(security definer) 함수인데
--     "그 결재 문서가 내 회사 것인지" 확인이 없었다. is_admin() 은 회사 구분 없이 "어느 회사든 관리자면 참"이라,
--     다른 회사 관리자가 결재 단계/문서 id 를 알면(무작위 uuid 라 쉽지는 않지만) 남의 회사 결재를 처리·회수할 수 있었다.
--     → 내 회사 문서가 아니면 "찾을 수 없습니다"로 거절한다.
--  2) 같은 결재 단계를 두 사람이(또는 승인+반려 / 승인+회수) 동시에 처리하면 둘 다 "아직 대기 중"을 읽고 통과해서
--     단계는 '반려'인데 문서는 '승인'이 되는 식으로 어긋날 수 있었다.
--     → 문서 행 → 단계 행 순서로 잠가(for update) 한 번에 한 명만 처리하게 하고, 잠근 뒤 상태를 다시 읽는다.
--     (회수도 같은 문서 행을 먼저 잠가서, 회수와 결재가 동시에 일어나도 한쪽만 성공한다.)
-- 함수 모양(인자·반환)은 그대로 둔다 — 같은 시그니처라 "진짜 교체"가 된다.

create or replace function public.decide_approval_step(
  p_step_id uuid,
  p_decision text,
  p_comment text default null
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_doc_id uuid;
  v_doc_status text;
  v_approver_id uuid;
  v_step_order smallint;
  v_step_status text;
  v_role text;
  v_max_order smallint;
  v_earlier_unapproved integer;
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception '잘못된 처리입니다.';
  end if;

  -- 문서 id 만 먼저 알아낸 뒤, 문서 → 단계 순서로 잠근다(회수 함수와 같은 순서라 교착이 없다).
  select document_id into v_doc_id from public.approval_steps where id = p_step_id;
  if v_doc_id is null then
    raise exception '결재 단계를 찾을 수 없습니다.';
  end if;

  select status into v_doc_status
  from public.approval_documents
  where id = v_doc_id and tenant_id = public.current_tenant_id()
  for update;
  if not found then
    raise exception '결재 단계를 찾을 수 없습니다.';
  end if;

  select approver_id, step_order, status, role
    into v_approver_id, v_step_order, v_step_status, v_role
  from public.approval_steps where id = p_step_id
  for update;

  if v_role <> 'approver' then
    raise exception '참조자는 결재를 처리할 수 없습니다.';
  end if;
  if v_doc_status <> 'pending' then
    raise exception '이미 종료되었거나 회수된 기안입니다.';
  end if;

  if v_approver_id <> v_actor and not public.is_admin() and not public.is_active_delegate_for(v_approver_id) then
    raise exception '본인 차례의 결재만 처리할 수 있습니다.';
  end if;
  if v_step_status <> 'pending' then
    raise exception '이미 처리된 결재입니다.';
  end if;

  select count(*) into v_earlier_unapproved
  from public.approval_steps
  where document_id = v_doc_id and role = 'approver' and step_order < v_step_order and status <> 'approved';
  if v_earlier_unapproved > 0 then
    raise exception '앞 순번 결재가 아직 끝나지 않았습니다.';
  end if;

  update public.approval_steps
  set status = p_decision, comment = p_comment, decided_at = now(), decided_by = v_actor
  where id = p_step_id;

  if p_decision = 'rejected' then
    update public.approval_documents
    set status = 'rejected', decided_at = now()
    where id = v_doc_id;
    return;
  end if;

  select max(step_order) into v_max_order
  from public.approval_steps where document_id = v_doc_id and role = 'approver';
  if v_step_order = v_max_order then
    update public.approval_documents
    set status = 'approved', decided_at = now()
    where id = v_doc_id;
  end if;
end;
$$;

create or replace function public.recall_approval_document(p_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_created_by uuid;
  v_status text;
  v_decided_count integer;
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;

  select created_by, status into v_created_by, v_status
  from public.approval_documents
  where id = p_id and tenant_id = public.current_tenant_id()
  for update;

  if v_created_by is null then
    raise exception '문서를 찾을 수 없습니다.';
  end if;
  if v_created_by <> v_actor and not public.is_admin() then
    raise exception '본인이 기안한 문서만 회수할 수 있습니다.';
  end if;
  if v_status <> 'pending' then
    raise exception '결재가 진행중인 기안만 회수할 수 있습니다.';
  end if;

  select count(*) into v_decided_count
  from public.approval_steps
  where document_id = p_id and role = 'approver' and status <> 'pending';
  if v_decided_count > 0 then
    raise exception '이미 결재를 진행한 사람이 있어 회수할 수 없습니다. 결재자에게 반려를 요청해주세요.';
  end if;

  update public.approval_documents set status = 'recalled', recalled_at = now() where id = p_id;
end;
$$;

revoke all on function public.decide_approval_step(uuid, text, text) from public;
grant execute on function public.decide_approval_step(uuid, text, text) to authenticated;
revoke all on function public.recall_approval_document(uuid) from public;
grant execute on function public.recall_approval_document(uuid) to authenticated;
