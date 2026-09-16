-- 임시저장함 + 기안 회수.
--
-- 임시저장(draft)은 결재선을 아직 확정하지 않은 채로 "결재자/참조자로
-- 담아둔 명단"만 배열 컬럼에 잠깐 들고 있다가, 제출하는 순간에야 비로소
-- approval_steps 행을 만든다 — 임시저장 단계에서 미리 approval_steps를
-- 만들어두면 아직 제출도 안 한 문서가 결재자 화면에 "내 차례"로 잘못
-- 뜨는 문제가 생기기 때문이다.
--
-- 회수(recall)는 결재자가 한 명이라도 이미 처리(승인/반려)한 뒤에는
-- 허용하지 않는다 — 이미 결재한 사람 입장에서 "내 결재가 없었던 일이
-- 됨" 문제가 생기기 때문. 그 경우엔 회수 대신 결재자에게 반려를
-- 요청하는 것이 맞는 절차다.
alter table public.approval_documents drop constraint if exists approval_documents_status_check;
alter table public.approval_documents add constraint approval_documents_status_check
  check (status in ('draft', 'pending', 'approved', 'rejected', 'recalled'));

alter table public.approval_documents add column if not exists recalled_at timestamptz;
alter table public.approval_documents add column if not exists draft_approver_ids uuid[] not null default '{}';
alter table public.approval_documents add column if not exists draft_reference_ids uuid[] not null default '{}';

-- 임시저장 생성/수정 — p_id가 null이면 새로 만들고, 있으면 본인이 작성한
-- draft 상태 문서만 덮어쓴다. approval_documents에 update 정책이 없으므로
-- (상태 변경은 지금까지 전부 security definer RPC를 통해서만 이뤄짐)
-- 이 함수도 같은 방침을 따르되, 함수 내부에서 소유자/상태를 엄격히 검증한다.
create or replace function public.save_approval_draft(
  p_id uuid,
  p_title text,
  p_content text,
  p_approver_ids uuid[] default '{}',
  p_reference_ids uuid[] default '{}'
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_doc_id uuid;
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;
  if p_title is null or trim(p_title) = '' then
    raise exception '제목을 입력해주세요.';
  end if;

  if p_id is null then
    insert into public.approval_documents (title, content, status, created_by, draft_approver_ids, draft_reference_ids)
    values (p_title, coalesce(p_content, ''), 'draft', v_actor, coalesce(p_approver_ids, '{}'), coalesce(p_reference_ids, '{}'))
    returning id into v_doc_id;
  else
    update public.approval_documents
    set title = p_title,
        content = coalesce(p_content, ''),
        draft_approver_ids = coalesce(p_approver_ids, '{}'),
        draft_reference_ids = coalesce(p_reference_ids, '{}')
    where id = p_id and created_by = v_actor and status = 'draft'
    returning id into v_doc_id;

    if v_doc_id is null then
      raise exception '수정할 임시저장 문서를 찾을 수 없습니다.';
    end if;
  end if;

  return v_doc_id;
end;
$$;

-- 임시저장 문서를 실제로 제출한다 — 이 시점에 비로소 approval_steps가
-- 생성되고 결재자 화면에 "내 차례"로 나타난다.
create or replace function public.submit_approval_draft(p_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_status text;
  v_created_by uuid;
  v_approver_ids uuid[];
  v_reference_ids uuid[];
  v_user_id uuid;
  v_order smallint := 0;
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;

  select status, created_by, draft_approver_ids, draft_reference_ids
    into v_status, v_created_by, v_approver_ids, v_reference_ids
  from public.approval_documents where id = p_id;

  if v_created_by is null then
    raise exception '문서를 찾을 수 없습니다.';
  end if;
  if v_created_by <> v_actor and not public.is_admin() then
    raise exception '본인이 작성한 임시저장 문서만 제출할 수 있습니다.';
  end if;
  if v_status <> 'draft' then
    raise exception '임시저장 상태의 문서만 제출할 수 있습니다.';
  end if;
  if v_approver_ids is null or array_length(v_approver_ids, 1) is null then
    raise exception '결재선(승인자)을 1명 이상 지정해주세요.';
  end if;

  foreach v_user_id in array v_approver_ids loop
    v_order := v_order + 1;
    insert into public.approval_steps (document_id, step_order, approver_id, role)
    values (p_id, v_order, v_user_id, 'approver');
  end loop;

  if v_reference_ids is not null then
    foreach v_user_id in array v_reference_ids loop
      insert into public.approval_steps (document_id, step_order, approver_id, role)
      values (p_id, null, v_user_id, 'reference');
    end loop;
  end if;

  update public.approval_documents set status = 'pending' where id = p_id;
end;
$$;

-- 제출된(pending) 기안을 기안자 스스로 회수한다 — 아직 아무도 결재하지
-- 않은 경우에만 허용한다.
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
  from public.approval_documents where id = p_id;

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

revoke all on function public.save_approval_draft(uuid, text, text, uuid[], uuid[]) from public;
grant execute on function public.save_approval_draft(uuid, text, text, uuid[], uuid[]) to authenticated;
revoke all on function public.submit_approval_draft(uuid) from public;
grant execute on function public.submit_approval_draft(uuid) to authenticated;
revoke all on function public.recall_approval_document(uuid) from public;
grant execute on function public.recall_approval_document(uuid) to authenticated;
