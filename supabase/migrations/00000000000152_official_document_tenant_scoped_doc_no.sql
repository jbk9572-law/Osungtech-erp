-- 공문 문서번호(official_documents.doc_no)가 postgres 시퀀스 하나
-- (official_documents_doc_no_seq)를 모든 테넌트가 공유해서 채번됐다 —
-- 전체 감사에서 발견. 매출/매입 doc_no도 같은 구조의 전역 시퀀스이긴
-- 하지만 그 번호는 내부 명세표 인쇄에만 쓰이고 밖으로 안 나간다. 공문은
-- 거래처·관공서 등 회사 밖으로 발송되는 문서라(정보공개법 대응 모듈),
-- 번호가 연도 구분 없이 테넌트 간에도 계속 증가만 하면 외부에서 받은
-- 문서 번호만으로 이 회사가 전체 플랫폼에서(다른 테넌트 포함) 공문을
-- 얼마나 만들었는지 추정할 수 있고, 정식 문서번호 관행(연도별로 새로
-- 시작)과도 안 맞는다.
--
-- 테넌트별·연도별로 새로 시작하는 채번으로 바꾼다. 화면에는 "연도-일련
-- 번호"(예: 2026-000047)로 보여줘서 같은 테넌트 안에서도 연도가 다르면
-- 번호가 겹쳐도 헷갈리지 않게 한다.
create table if not exists public.official_document_no_counters (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  year integer not null,
  last_no bigint not null default 0,
  primary key (tenant_id, year)
);

alter table public.official_document_no_counters enable row level security;
create policy "official_document_no_counters_select" on public.official_document_no_counters
  for select using (tenant_id = public.current_tenant_id());

alter table public.official_documents add column if not exists doc_no_year integer;

create or replace function public.sync_official_document_from_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_year integer := extract(year from now())::int;
  v_next_no bigint;
begin
  if new.status not in ('approved', 'rejected') or new.status = old.status then
    return new;
  end if;

  if new.status = 'approved' then
    select tenant_id into v_tenant_id
    from public.official_documents
    where approval_document_id = new.id and status = 'pending_approval' and doc_no is null
    limit 1;

    if v_tenant_id is not null then
      insert into public.official_document_no_counters (tenant_id, year, last_no)
      values (v_tenant_id, v_year, 1)
      on conflict (tenant_id, year) do update set last_no = official_document_no_counters.last_no + 1
      returning last_no into v_next_no;

      update public.official_documents
      set status = 'approved', doc_no = v_next_no, doc_no_year = v_year
      where approval_document_id = new.id and status = 'pending_approval' and doc_no is null;
    else
      -- doc_no가 이미 있는 경우(반려 후 재상신 등 드문 경로) — 번호는 그대로
      -- 두고 상태만 갱신한다.
      update public.official_documents
      set status = 'approved'
      where approval_document_id = new.id and status = 'pending_approval';
    end if;
  else
    update public.official_documents
    set status = 'draft', approval_document_id = null
    where approval_document_id = new.id and status = 'pending_approval';
  end if;

  return new;
end;
$$;
