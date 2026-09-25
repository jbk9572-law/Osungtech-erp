-- 전결권(대리결재) 위임을 받은 사람이 실제로는 기안함/문서를 못 보던 버그.
--
-- migration 111에서 approval_steps_select 정책엔 is_active_delegate_for()
-- 조건을 추가했지만, is_approval_step_approver()(migration 108, 전결권
-- 도입 이전에 만들어짐)는 여전히 "s.approver_id = auth.uid()"만 확인한다.
-- approval_documents_select가 바로 이 함수를 쓰므로, 대리인은 approval_steps
-- 조회는 통과해도 그 문서 자체(approval_documents)가 안 보여 기안함
-- 목록/상세 어디서도 대결할 문서를 찾을 수 없었다(결재 처리 RPC인
-- decide_approval_step은 대리인을 이미 허용하고 있어서, 화면에 안 뜰 뿐
-- URL을 직접 알면 처리 자체는 가능한 반쪽짜리 기능이었다).
--
-- 같은 이유로 official_documents_select/official_document_recipients_select
-- (migration 142)도 approval_steps를 "s.approver_id = auth.uid()"로 직접
-- 걸러 똑같이 대리인에게 공문이 안 보였다 — 이 함수 하나로 통일해서 재사용한다.
create or replace function public.is_approval_step_approver(p_document_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.approval_steps s
    where s.document_id = p_document_id
      and (s.approver_id = auth.uid() or public.is_active_delegate_for(s.approver_id))
  );
$$;

drop policy if exists "official_documents_select" on public.official_documents;
create policy "official_documents_select" on public.official_documents
  for select using (
    created_by = auth.uid()
    or public.is_admin()
    or public.is_approval_step_approver(official_documents.approval_document_id)
    or exists (
      select 1 from public.official_document_recipients r
      where r.official_document_id = official_documents.id and r.user_id = auth.uid()
    )
    or (visibility_scope = 'all' and status in ('sent', 'closed'))
  );

drop policy if exists "official_document_recipients_select" on public.official_document_recipients;
create policy "official_document_recipients_select" on public.official_document_recipients
  for select using (
    exists (
      select 1 from public.official_documents d
      where d.id = official_document_recipients.official_document_id
        and (
          d.created_by = auth.uid()
          or public.is_admin()
          or public.is_approval_step_approver(d.approval_document_id)
          or user_id = auth.uid()
          or (d.visibility_scope = 'all' and d.status in ('sent', 'closed'))
        )
    )
  );
