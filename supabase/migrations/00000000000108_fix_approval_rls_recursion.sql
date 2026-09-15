-- migration 102 버그 수정: approval_documents ↔ approval_steps RLS
-- 정책 순환 참조.
--
-- approval_documents_select 정책이 (승인자인지 확인하려고)
-- approval_steps를 EXISTS로 조회하는데, approval_steps 자체도 RLS가
-- 걸려 있어서 그 조회가 approval_steps_select 정책을 통과해야 한다.
-- 그런데 approval_steps_select 정책은 (기안자인지 확인하려고) 거꾸로
-- approval_documents를 EXISTS로 조회한다 — 이 조회가 다시
-- approval_documents_select 정책을 거쳐야 하므로 무한 루프가 된다
-- ("infinite recursion detected in policy for relation
-- approval_documents").
--
-- is_admin()/is_demo_actor()/current_tenant_id()가 이미 쓰고 있는
-- 해법과 같다 — security definer 함수는 함수 소유자(테이블 소유자)
-- 권한으로 실행되어 그 안의 조회가 RLS를 아예 안 거치므로, 정책이
-- "다른 RLS 테이블을 직접 EXISTS로 조회" 하는 대신 "그 결과만 돌려주는
-- security definer 함수를 호출"하게 바꾸면 순환이 끊긴다.
create or replace function public.is_approval_step_approver(p_document_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.approval_steps s
    where s.document_id = p_document_id and s.approver_id = auth.uid()
  );
$$;

create or replace function public.is_approval_document_owner(p_document_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.approval_documents d
    where d.id = p_document_id and d.created_by = auth.uid()
  );
$$;

revoke all on function public.is_approval_step_approver(uuid) from public;
grant execute on function public.is_approval_step_approver(uuid) to authenticated;
revoke all on function public.is_approval_document_owner(uuid) from public;
grant execute on function public.is_approval_document_owner(uuid) to authenticated;

drop policy if exists "approval_documents_select" on public.approval_documents;
create policy "approval_documents_select" on public.approval_documents
  for select using (
    created_by = auth.uid()
    or public.is_admin()
    or public.is_approval_step_approver(approval_documents.id)
  );

drop policy if exists "approval_steps_select" on public.approval_steps;
create policy "approval_steps_select" on public.approval_steps
  for select using (
    approver_id = auth.uid()
    or public.is_admin()
    or public.is_approval_document_owner(approval_steps.document_id)
  );

-- delete_own_document도 같은 방식(approval_documents를 직접 EXISTS로
-- 조회)이라 같은 순환 문제가 있었다.
drop policy if exists "approval_steps_delete_own_document" on public.approval_steps;
create policy "approval_steps_delete_own_document" on public.approval_steps
  for delete using (
    public.is_admin() or public.is_approval_document_owner(approval_steps.document_id)
  );
