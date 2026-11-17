-- 결재 계열 나머지 함수 점검(250의 연장) — 권한을 우회하는(security definer) 함수의 회사 확인 + 동시 처리 잠금.
--
--  1) submit_approval_draft / recall_payment_request / recall_purchase_request / submit_official_document:
--     문서를 id 로만 찾아서 "내 회사 것인지" 확인이 없었다(관리자 판별 is_admin() 은 회사 구분이 없다). → 내 회사 것만 찾는다.
--  2) 같은 문서를 더블클릭 등으로 동시에 제출/회수하면 둘 다 "아직 임시저장/제출 상태"를 읽고 통과해서
--     결재 단계가 두 번 만들어지거나(공문은 결재 문서가 두 개) 상태가 꼬일 수 있었다. → 그 행을 for update 로 잠근다.
--  3) 결재선·참조자에 "다른 회사 사람"의 id 를 넣을 수 있었다(제출 시 검증 없음). → 현재 회사 소속인지 검사하는 도우미를 두고
--     submit_approval_document / submit_approval_draft 가 부른다.
-- 함수 모양(인자·반환)은 그대로 둔다.

create or replace function public.assert_users_in_current_tenant(p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_tenant uuid := public.current_tenant_id();
begin
  if p_ids is null or array_length(p_ids, 1) is null then
    return;
  end if;
  if exists (
    select 1
    from unnest(p_ids) as x(id)
    where not exists (
      select 1 from public.tenant_members m where m.user_id = x.id and m.tenant_id = v_tenant
    )
  ) then
    raise exception '결재선에 우리 회사 직원이 아닌 사람이 포함되어 있습니다.';
  end if;
end;
$$;
revoke all on function public.assert_users_in_current_tenant(uuid[]) from public;
grant execute on function public.assert_users_in_current_tenant(uuid[]) to authenticated;

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
  perform public.assert_users_in_current_tenant(p_approver_ids);
  perform public.assert_users_in_current_tenant(p_reference_ids);

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
  from public.approval_documents
  where id = p_id and tenant_id = public.current_tenant_id()
  for update;

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
  perform public.assert_users_in_current_tenant(v_approver_ids);
  perform public.assert_users_in_current_tenant(v_reference_ids);

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
  from public.payment_requests
  where id = p_id and tenant_id = public.current_tenant_id()
  for update;

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

create or replace function public.recall_purchase_request(p_id uuid)
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
  from public.purchase_requests
  where id = p_id and tenant_id = public.current_tenant_id()
  for update;

  if v_owner is null then
    raise exception '구매요청을 찾을 수 없습니다.';
  end if;
  if v_owner is distinct from v_actor and not public.is_admin() then
    raise exception '본인이 작성한 구매요청만 회수할 수 있습니다.';
  end if;
  if v_status is distinct from 'pending' then
    raise exception '제출된 상태의 구매요청만 회수할 수 있습니다.';
  end if;

  if v_doc_id is not null then
    perform public.recall_approval_document(v_doc_id);
  end if;

  update public.purchase_requests set status = 'draft', approval_document_id = null where id = p_id;
end;
$$;

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

  select * into v_doc from public.official_documents
  where id = p_official_document_id and tenant_id = public.current_tenant_id()
  for update;
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

revoke all on function public.submit_approval_draft(uuid) from public;
grant execute on function public.submit_approval_draft(uuid) to authenticated;
revoke all on function public.recall_payment_request(uuid) from public;
grant execute on function public.recall_payment_request(uuid) to authenticated;
revoke all on function public.recall_purchase_request(uuid) from public;
grant execute on function public.recall_purchase_request(uuid) to authenticated;
revoke all on function public.submit_official_document(uuid, uuid[], uuid[]) from public;
grant execute on function public.submit_official_document(uuid, uuid[], uuid[]) to authenticated;
