-- 보안 점검(낮음) 마무리: 결재선·수신자에 "다른 회사 사람"이 들어갈 수 있던 두 곳.
--  1) 공문 수신처(사내) 추가 시 수신자 user_id 가 같은 회사 소속인지 검사하지 않았다.
--  2) 결재 임시저장(save_approval_draft)이 결재선·참조자 id 를 회사 소속 확인 없이 저장했다(제출 때 251 에서 막히지만 저장 단계에서 바로 거절한다).
drop policy if exists "official_document_recipients_insert" on public.official_document_recipients;
create policy "official_document_recipients_insert" on public.official_document_recipients
  for insert with check (
    exists (
      select 1 from public.official_documents d
      where d.id = official_document_recipients.official_document_id
        and d.created_by = auth.uid() and d.status = 'draft'
    )
    and (
      official_document_recipients.user_id is null
      or exists (
        select 1 from public.tenant_members m
        where m.user_id = official_document_recipients.user_id and m.tenant_id = public.current_tenant_id()
      )
    )
  );

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
  perform public.assert_users_in_current_tenant(p_approver_ids);
  perform public.assert_users_in_current_tenant(p_reference_ids);

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
    where id = p_id and created_by = v_actor and status = 'draft' and tenant_id = public.current_tenant_id()
    returning id into v_doc_id;

    if v_doc_id is null then
      raise exception '수정할 임시저장 문서를 찾을 수 없습니다.';
    end if;
  end if;

  return v_doc_id;
end;
$$;
revoke all on function public.save_approval_draft(uuid, text, text, uuid[], uuid[]) from public;
grant execute on function public.save_approval_draft(uuid, text, text, uuid[], uuid[]) to authenticated;
