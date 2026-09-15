-- 전자결재에 참조자(결재는 안 하고 열람만) 지원 추가.
--
-- 결재자(approver)는 지금처럼 step_order 순서대로 처리되고, 참조자
-- (reference)는 step_order가 없어 순서 로직에서 아예 제외된다 —
-- 문서를 볼 수 있을 뿐 승인/반려 대상이 아니다.
alter table public.approval_steps add column if not exists role text not null default 'approver' check (role in ('approver', 'reference'));
alter table public.approval_steps alter column step_order drop not null;

create or replace function public.submit_approval_document(
  p_title text,
  p_content text,
  p_approver_ids uuid[],
  p_reference_ids uuid[] default '{}'
)
returns uuid
language plpgsql
as $$
declare
  v_doc_id uuid;
  v_actor uuid := auth.uid();
  v_user_id uuid;
  v_order smallint := 0;
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;
  if p_title is null or trim(p_title) = '' then
    raise exception '제목을 입력해주세요.';
  end if;
  if p_approver_ids is null or array_length(p_approver_ids, 1) is null then
    raise exception '결재선(승인자)을 1명 이상 지정해주세요.';
  end if;

  insert into public.approval_documents (title, content, created_by)
  values (p_title, coalesce(p_content, ''), v_actor)
  returning id into v_doc_id;

  foreach v_user_id in array p_approver_ids loop
    v_order := v_order + 1;
    insert into public.approval_steps (document_id, step_order, approver_id, role)
    values (v_doc_id, v_order, v_user_id, 'approver');
  end loop;

  if p_reference_ids is not null then
    foreach v_user_id in array p_reference_ids loop
      insert into public.approval_steps (document_id, step_order, approver_id, role)
      values (v_doc_id, null, v_user_id, 'reference');
    end loop;
  end if;

  return v_doc_id;
end;
$$;

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

  select document_id, approver_id, step_order, status, role
    into v_doc_id, v_approver_id, v_step_order, v_step_status, v_role
  from public.approval_steps where id = p_step_id;

  if v_doc_id is null then
    raise exception '결재 단계를 찾을 수 없습니다.';
  end if;
  if v_role <> 'approver' then
    raise exception '참조자는 결재를 처리할 수 없습니다.';
  end if;
  if v_approver_id <> v_actor and not public.is_admin() then
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
  set status = p_decision, comment = p_comment, decided_at = now()
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
