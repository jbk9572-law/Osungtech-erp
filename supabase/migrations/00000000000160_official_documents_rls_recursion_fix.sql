-- 내공문함/받은공문함(/official-documents)에서 "infinite recursion
-- detected in policy for relation official_documents" 에러가 발생했다.
--
-- 원인: official_documents_select 정책(migration 145)이 조회 조건 중
-- 하나로 official_document_recipients를 EXISTS 서브쿼리로 참조하고,
-- official_document_recipients_select 정책은 반대로 official_documents를
-- EXISTS 서브쿼리로 참조한다. RLS 정책의 USING절 안에 있는 서브쿼리도
-- 그 대상 테이블 자신의 RLS를 그대로 다시 타므로, official_documents를
-- 조회 → 정책이 official_document_recipients를 조회 → 그 정책이 다시
-- official_documents를 조회 → ... 로 무한히 맞물린다.
--
-- is_approval_step_approver()(migration 145)가 이미 같은 이유로
-- security definer 함수를 쓰고 있다 — security definer 함수 안에서는
-- 호출자(auth.uid())가 아니라 함수 소유자 권한으로 쿼리가 돌아서 그
-- 안에서 만지는 테이블들의 RLS를 다시 타지 않는다(테이블 소유자에게는
-- RLS가 기본적으로 적용되지 않으므로). 같은 패턴으로 두 정책의
-- 교차 참조를 각각 security definer 함수로 감싸서 순환을 끊는다.

create or replace function public.is_official_document_recipient(p_document_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.official_document_recipients r
    where r.official_document_id = p_document_id and r.user_id = auth.uid()
  );
$$;

create or replace function public.can_view_official_document(p_document_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.official_documents d
    where d.id = p_document_id
      and (
        d.created_by = auth.uid()
        or public.is_admin()
        or public.is_approval_step_approver(d.approval_document_id)
        or public.is_official_document_recipient(d.id)
        or (d.visibility_scope = 'all' and d.status in ('sent', 'closed'))
      )
  );
$$;

drop policy if exists "official_documents_select" on public.official_documents;
create policy "official_documents_select" on public.official_documents
  for select using (
    created_by = auth.uid()
    or public.is_admin()
    or public.is_approval_step_approver(official_documents.approval_document_id)
    or public.is_official_document_recipient(official_documents.id)
    or (visibility_scope = 'all' and status in ('sent', 'closed'))
  );

drop policy if exists "official_document_recipients_select" on public.official_document_recipients;
create policy "official_document_recipients_select" on public.official_document_recipients
  for select using (
    user_id = auth.uid()
    or public.can_view_official_document(official_document_recipients.official_document_id)
  );
