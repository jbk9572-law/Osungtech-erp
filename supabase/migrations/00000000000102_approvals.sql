-- 전자결재(기안) 1차 범위.
--
-- 기안서(approval_documents) + 결재선(approval_steps, 순서대로 승인자
-- 지정) 구조. 결재는 반드시 순서대로 진행된다 — 앞 단계가 승인되기
-- 전까지 뒤 단계 승인자는 결정을 내릴 수 없다(decide_approval_step에서
-- 검증). 하나라도 반려되면 문서 전체가 반려로 끝난다.

create table if not exists public.approval_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  is_demo boolean not null default public.is_demo_actor(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id)
);

create table if not exists public.approval_steps (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.approval_documents (id) on delete cascade,
  step_order smallint not null check (step_order > 0),
  approver_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  comment text,
  decided_at timestamptz,
  is_demo boolean not null default public.is_demo_actor(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  unique (document_id, step_order)
);

create index if not exists approval_documents_created_by_idx on public.approval_documents (created_by);
create index if not exists approval_documents_tenant_id_idx on public.approval_documents (tenant_id);
create index if not exists approval_steps_document_id_idx on public.approval_steps (document_id);
create index if not exists approval_steps_approver_id_idx on public.approval_steps (approver_id);
create index if not exists approval_steps_tenant_id_idx on public.approval_steps (tenant_id);

alter table public.approval_documents enable row level security;
alter table public.approval_steps enable row level security;

-- 기안자 본인, 결재선에 포함된 승인자, 관리자만 문서를 볼 수 있다 —
-- 사내 결재는 무관한 사람에게 내용이 새면 안 되는 민감 정보라 나머지
-- 업무 테이블처럼 "로그인한 사용자면 전체 조회"로 열어두지 않는다.
create policy "approval_documents_select" on public.approval_documents
  for select using (
    created_by = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.approval_steps s
      where s.document_id = approval_documents.id and s.approver_id = auth.uid()
    )
  );
create policy "approval_documents_insert" on public.approval_documents
  for insert with check (auth.role() = 'authenticated');
-- 문서 내용 수정(제목/본문)은 지금 범위에 없다 — 상태(status/decided_at)
-- 갱신은 decide_approval_step() RPC(security definer)를 통해서만 이뤄져
-- 별도 update 정책이 필요 없다(RPC가 테이블 소유자 권한으로 실행됨).
create policy "approval_documents_delete_own" on public.approval_documents
  for delete using (created_by = auth.uid() or public.is_admin());

create policy "approval_steps_select" on public.approval_steps
  for select using (
    approver_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.approval_documents d
      where d.id = approval_steps.document_id and d.created_by = auth.uid()
    )
  );
create policy "approval_steps_insert" on public.approval_steps
  for insert with check (auth.role() = 'authenticated');
create policy "approval_steps_delete_own_document" on public.approval_steps
  for delete using (
    public.is_admin()
    or exists (
      select 1 from public.approval_documents d
      where d.id = approval_steps.document_id and d.created_by = auth.uid()
    )
  );

create policy "approval_documents_demo_isolation" on public.approval_documents
  as restrictive for all
  using (is_demo = public.is_demo_actor())
  with check (is_demo = public.is_demo_actor());
create policy "approval_documents_tenant_isolation" on public.approval_documents
  as restrictive for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());
create policy "approval_steps_demo_isolation" on public.approval_steps
  as restrictive for all
  using (is_demo = public.is_demo_actor())
  with check (is_demo = public.is_demo_actor());
create policy "approval_steps_tenant_isolation" on public.approval_steps
  as restrictive for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- 기안서 + 결재선을 한 번에 만든다(create_sale_with_items와 같은 이유 —
-- 문서만 만들고 결재선이 비어버리는 반쪽 상태를 방지).
create or replace function public.submit_approval_document(
  p_title text,
  p_content text,
  p_approver_ids uuid[]
)
returns uuid
language plpgsql
as $$
declare
  v_doc_id uuid;
  v_actor uuid := auth.uid();
  v_approver_id uuid;
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

  foreach v_approver_id in array p_approver_ids loop
    v_order := v_order + 1;
    insert into public.approval_steps (document_id, step_order, approver_id)
    values (v_doc_id, v_order, v_approver_id);
  end loop;

  return v_doc_id;
end;
$$;

-- 결재 처리 — security definer로 만들어서, 승인자가 approval_documents를
-- 직접 update할 수 있는 정책 없이도(위 select 정책만으로) 상태를 안전하게
-- 바꿀 수 있게 한다. 대신 함수 안에서 "지금 이 사람 차례가 맞는지"를
-- 엄격히 검증한다 — 그렇지 않으면 무권한 상태변경이 가능해진다.
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
  v_max_order smallint;
  v_earlier_unapproved integer;
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception '잘못된 처리입니다.';
  end if;

  select document_id, approver_id, step_order, status
    into v_doc_id, v_approver_id, v_step_order, v_step_status
  from public.approval_steps where id = p_step_id;

  if v_doc_id is null then
    raise exception '결재 단계를 찾을 수 없습니다.';
  end if;
  if v_approver_id <> v_actor and not public.is_admin() then
    raise exception '본인 차례의 결재만 처리할 수 있습니다.';
  end if;
  if v_step_status <> 'pending' then
    raise exception '이미 처리된 결재입니다.';
  end if;

  select count(*) into v_earlier_unapproved
  from public.approval_steps
  where document_id = v_doc_id and step_order < v_step_order and status <> 'approved';
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

  select max(step_order) into v_max_order from public.approval_steps where document_id = v_doc_id;
  if v_step_order = v_max_order then
    update public.approval_documents
    set status = 'approved', decided_at = now()
    where id = v_doc_id;
  end if;
end;
$$;

revoke all on function public.decide_approval_step(uuid, text, text) from public;
grant execute on function public.decide_approval_step(uuid, text, text) to authenticated;
