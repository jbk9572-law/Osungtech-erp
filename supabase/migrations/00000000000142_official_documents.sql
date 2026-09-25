-- 공문관리 — 전자결재 옆에 두는 새 모듈. 사내에서만 도는 기안서
-- (approval_documents)와 달리 회사 밖(거래처·관공서 등)으로 나가는 공식
-- 문서를 다룬다. 결재까지는 기존 전자결재 인프라(submit_approval_document,
-- 결재선/전결권)를 그대로 재사용하고(leave_requests/
-- attendance_correction_requests와 같은 approval_document_id 연결 패턴),
-- 그 이후(문서번호 부여, 수신처별 발송 추적, 정보공개법 대응)만 이 모듈
-- 고유 로직으로 둔다. 양식(문서 본문 틀)도 인사관리 문서양식
-- (document_templates)을 그대로 쓴다 — {{field}} 병합필드/자동필드(오늘
-- 날짜 등) 엔진을 두 번 만들 이유가 없다.

alter table public.document_templates
  drop constraint if exists document_templates_category_check;
alter table public.document_templates
  add constraint document_templates_category_check
  check (category in ('hr_contract', 'hr_certificate', 'approval', 'official', 'general'));

create sequence if not exists public.official_documents_doc_no_seq;

create table public.official_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  is_demo boolean not null default public.is_demo_actor(),
  template_id uuid references public.document_templates (id) on delete set null,
  title text not null,
  body text not null default '',
  status text not null default 'draft' check (
    status in ('draft', 'pending_approval', 'approved', 'sent', 'closed', 'cancelled')
  ),
  -- 결재가 끝나는 시점에만 채번한다(작성중 문서까지 번호가 붙지 않게) —
  -- official_documents_doc_no_seq는 sync_official_document_from_approval()
  -- 트리거에서만 nextval()로 사용한다.
  doc_no bigint,
  -- 정보공개법(공공기관 대상이 아니어도 기업 문서관리 관행으로 그대로
  -- 채용)상 대외 공개 구분 — 사내에서 누가 보는지(아래 visibility_scope)와는
  -- 다른 축이다.
  disclosure text not null default 'public' check (disclosure in ('public', 'partial', 'private')),
  disclosure_reason text,
  -- 사내 열람범위 — 전체 직원 공개(발송·종결 후) 또는 작성자·결재선·
  -- 수신처(관련자)만. 부서 단위 공개는 상위부서 포함 여부 등 규칙이
  -- 더 필요해 1차 범위에서는 뺐다(전체/관련자 두 값만 지원).
  visibility_scope text not null default 'related' check (visibility_scope in ('all', 'related')),
  retention text not null default '5' check (retention in ('permanent', '1', '3', '5', '10', '30')),
  effective_date date,
  -- 사내 보관용(외부 발송 없음) 공문 — 켜면 수신처 없이도 결재 상신할 수
  -- 있고, 발송 단계 없이 결재 완료 시 바로 종결 처리 대상이 된다.
  internal_only boolean not null default false,
  approval_document_id uuid references public.approval_documents (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  closed_at timestamptz
);

create table public.official_document_recipients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  is_demo boolean not null default public.is_demo_actor(),
  official_document_id uuid not null references public.official_documents (id) on delete cascade,
  kind text not null check (kind in ('external', 'internal')),
  -- 외부 수신처는 이름(기관명 등)을 직접 입력받고, 사내 수신처는
  -- user_id로 연결하되 표시용으로 이름도 함께 저장해둔다(그 시점 이름을
  -- 그대로 남겨 나중에 이름이 바뀌어도 발송 당시 기록이 안 바뀌게).
  name text not null,
  email text,
  user_id uuid references public.profiles (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'bounced', 'delivered_manual')),
  bounce_reason text,
  sent_at timestamptz
);

create index official_documents_tenant_id_idx on public.official_documents (tenant_id);
create index official_documents_created_by_idx on public.official_documents (created_by);
create index official_documents_approval_document_id_idx on public.official_documents (approval_document_id);
create index official_document_recipients_official_document_id_idx on public.official_document_recipients (official_document_id);
create index official_document_recipients_tenant_id_idx on public.official_document_recipients (tenant_id);
create index official_document_recipients_user_id_idx on public.official_document_recipients (user_id);

alter table public.official_documents enable row level security;
alter table public.official_document_recipients enable row level security;

create policy "official_documents_tenant_isolation" on public.official_documents
  as restrictive for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());
create policy "official_documents_demo_isolation" on public.official_documents
  as restrictive for all
  using (is_demo = public.is_demo_actor())
  with check (is_demo = public.is_demo_actor());

-- 작성자 본인, 관리자, 결재선(결재자·참조자)에 포함된 사람, 수신처로
-- 지정된 사내 구성원, 그리고 전체공개로 발송·종결된 문서는 누구나 볼 수
-- 있다 — approval_documents_select와 같은 원칙(무관한 사람에게 새면 안
-- 되는 문서는 좁게, 이미 배포 대상인 문서는 넓게).
create policy "official_documents_select" on public.official_documents
  for select using (
    created_by = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.approval_steps s
      where s.document_id = official_documents.approval_document_id and s.approver_id = auth.uid()
    )
    or exists (
      select 1 from public.official_document_recipients r
      where r.official_document_id = official_documents.id and r.user_id = auth.uid()
    )
    or (visibility_scope = 'all' and status in ('sent', 'closed'))
  );

create policy "official_documents_insert" on public.official_documents
  for insert with check (auth.role() = 'authenticated' and created_by = auth.uid());

-- 작성중(draft) 상태일 때만 본인이 직접 고칠 수 있다 — 상신 이후의 상태
-- 전이(pending_approval/approved/sent/closed)는 아래 RPC·트리거(모두
-- security definer 또는 그와 동등한 함수 경로)로만 이뤄진다.
create policy "official_documents_update_own_draft" on public.official_documents
  for update
  using (created_by = auth.uid() and status = 'draft')
  with check (created_by = auth.uid() and status = 'draft');

create policy "official_documents_delete_own_draft" on public.official_documents
  for delete using (created_by = auth.uid() and status = 'draft');

-- 수신처는 문서를 볼 수 있는 사람과 같은 범위에서 조회 가능 — 별도로
-- official_documents를 다시 조인해 판단한다(문서 자체의 select 정책을
-- 그대로 재사용하면 순환 참조가 되므로 조건을 그대로 복사한다).
create policy "official_document_recipients_select" on public.official_document_recipients
  for select using (
    exists (
      select 1 from public.official_documents d
      where d.id = official_document_recipients.official_document_id
        and (
          d.created_by = auth.uid()
          or public.is_admin()
          or exists (
            select 1 from public.approval_steps s
            where s.document_id = d.approval_document_id and s.approver_id = auth.uid()
          )
          or user_id = auth.uid()
          or (d.visibility_scope = 'all' and d.status in ('sent', 'closed'))
        )
    )
  );

-- 수신처 추가/삭제는 작성중인 문서의 작성자만 — 상신 이후에는 official_documents
-- 자체가 잠기는 것과 같은 이유로 수신처 목록도 더는 못 바꾼다.
create policy "official_document_recipients_insert" on public.official_document_recipients
  for insert with check (
    exists (
      select 1 from public.official_documents d
      where d.id = official_document_recipients.official_document_id
        and d.created_by = auth.uid() and d.status = 'draft'
    )
  );
create policy "official_document_recipients_delete" on public.official_document_recipients
  for delete using (
    exists (
      select 1 from public.official_documents d
      where d.id = official_document_recipients.official_document_id
        and d.created_by = auth.uid() and d.status = 'draft'
    )
  );

-- 발송 처리(상태 sent/bounced/delivered_manual로 전이)는 서버 액션이
-- service_role로 하므로(실제 SMTP 발송 자체가 사용자 세션 권한 밖의
-- 일이라) 별도 update 정책이 필요 없다 — service_role은 RLS를 우회한다.

-- 공문을 결재선에 태운다. 작성중(draft) 상태인 본인 문서만 상신할 수
-- 있고, 사내보관용(internal_only)이 아니면 수신처가 최소 1곳 있어야
-- 한다(발송할 곳 없는 대외문서를 만들 수 없게).
-- security definer로 선언한다 — 이 함수가 official_documents의 상태를
-- draft에서 pending_approval로 바꾸는데, 그 전이를 허용하는 별도 update
-- 정책을 두는 대신(허용된 상태 전이 쌍마다 RLS로 옳게 표현하기 까다롭다)
-- 함수 본문이 이미 소유자(created_by = auth.uid())와 현재 상태(draft)를
-- 직접 검증하므로 안전하다 — sync_official_document_from_approval() 트리거와
-- 같은 방식.
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

  select * into v_doc from public.official_documents where id = p_official_document_id;
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

  return v_approval_doc_id;
end;
$$;

revoke all on function public.submit_official_document(uuid, uuid[], uuid[]) from public;
grant execute on function public.submit_official_document(uuid, uuid[], uuid[]) to authenticated;

-- 결재 문서가 승인/반려로 끝나면 연결된 공문 상태에도 반영한다.
-- 승인되면 이 시점에 처음으로 문서번호를 부여하고(이미 번호가 있으면
-- 건드리지 않음 — 반려 후 재상신으로 두 번째 승인을 받는 경우는 없지만
-- 방어적으로 둠), 반려되면 작성중으로 되돌려 다시 고쳐서 상신할 수 있게
-- 한다(approval_document_id는 비워 다음 상신이 새 결재문서를 만들게 함 —
-- approval_documents는 상태가 끝나면 내용을 못 고치는 문서라 반려된
-- 것을 재사용하면 안 됨).
create or replace function public.sync_official_document_from_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status not in ('approved', 'rejected') or new.status = old.status then
    return new;
  end if;

  if new.status = 'approved' then
    update public.official_documents
    set status = 'approved',
        doc_no = coalesce(doc_no, nextval('public.official_documents_doc_no_seq'))
    where approval_document_id = new.id and status = 'pending_approval';
  else
    update public.official_documents
    set status = 'draft', approval_document_id = null
    where approval_document_id = new.id and status = 'pending_approval';
  end if;

  return new;
end;
$$;

drop trigger if exists sync_official_document_from_approval_trigger on public.approval_documents;
create trigger sync_official_document_from_approval_trigger
  after update on public.approval_documents
  for each row execute procedure public.sync_official_document_from_approval();
