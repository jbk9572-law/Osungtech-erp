-- 백로그 #1: 구매요청 → 구매발주 승인 워크플로우.
--
-- 지금까지 매입관리(purchase_orders)는 이미 발생한 입고를 기록하는
-- 화면이라, "이걸 사고 싶다"는 사내 요청 단계가 없었다(견적서가 매출
-- 전 단계 역할을 하는 것과 대칭). 이번에 구매요청(purchase_requests)을
-- 추가한다:
--   1) 평소엔 초안(draft)으로 자유롭게 작성
--   2) 다 쓰면 "제출"해서 결재선(승인자)을 지정 — leave_requests와 같은
--      1회성 결재 패턴(payment_requests처럼 매달 이어쓰는 장부가
--      아니라 건별 기안이라 더 단순한 패턴이 맞음)
--   3) 승인되면 품목을 다시 입력할 필요 없이 그대로 구매발주
--      (purchase_orders)로 전환 — quotes.converted_sales_order_id와
--      동일한 패턴, 전환 자체는 앱 서버 액션에서 create_purchase_with_items
--      RPC를 호출해 처리하고 여기서는 링크 컬럼만 둔다.
--
-- 두 테이블 모두 다른 업무 테이블과 동일한 tenant_id(RESTRICTIVE) +
-- is_demo(RESTRICTIVE) 이중 격리를 그대로 따른다(migration 85/99 패턴).

create table public.purchase_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  supplier_id uuid not null references public.suppliers (id) on delete cascade,
  request_date date not null default current_date,
  memo text,
  status text not null default 'draft' check (status in ('draft', 'pending', 'approved', 'rejected')),
  approval_document_id uuid references public.approval_documents (id) on delete set null,
  decided_at timestamptz,
  decided_by uuid references public.profiles (id) on delete set null,
  converted_purchase_order_id uuid references public.purchase_orders (id) on delete set null,
  is_demo boolean not null default public.is_demo_actor(),
  requested_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index purchase_requests_tenant_id_idx on public.purchase_requests (tenant_id);
create index purchase_requests_supplier_id_idx on public.purchase_requests (supplier_id, request_date desc);
create index purchase_requests_approval_document_id_idx on public.purchase_requests (approval_document_id);

alter table public.purchase_requests enable row level security;

create policy "purchase_requests_tenant_isolation" on public.purchase_requests
  as restrictive
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy "purchase_requests_demo_isolation" on public.purchase_requests
  as restrictive
  for all
  using (is_demo = public.is_demo_actor())
  with check (is_demo = public.is_demo_actor());

create policy "purchase_requests_select_authenticated" on public.purchase_requests
  for select using (auth.role() = 'authenticated');
create policy "purchase_requests_insert_authenticated" on public.purchase_requests
  for insert with check (auth.role() = 'authenticated');
create policy "purchase_requests_update_authenticated" on public.purchase_requests
  for update using (auth.role() = 'authenticated');
create policy "purchase_requests_delete_authenticated" on public.purchase_requests
  for delete using (auth.role() = 'authenticated');

create table public.purchase_request_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  purchase_request_id uuid not null references public.purchase_requests (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  custom_name text,
  spec text,
  quantity numeric not null,
  estimated_unit_price numeric not null default 0,
  remark text,
  is_demo boolean not null default public.is_demo_actor(),
  created_at timestamptz not null default now()
);

create index purchase_request_items_purchase_request_id_idx on public.purchase_request_items (purchase_request_id);
create index purchase_request_items_tenant_id_idx on public.purchase_request_items (tenant_id);

alter table public.purchase_request_items enable row level security;

create policy "purchase_request_items_tenant_isolation" on public.purchase_request_items
  as restrictive
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy "purchase_request_items_demo_isolation" on public.purchase_request_items
  as restrictive
  for all
  using (is_demo = public.is_demo_actor())
  with check (is_demo = public.is_demo_actor());

create policy "purchase_request_items_select_authenticated" on public.purchase_request_items
  for select using (auth.role() = 'authenticated');
create policy "purchase_request_items_insert_authenticated" on public.purchase_request_items
  for insert with check (auth.role() = 'authenticated');
create policy "purchase_request_items_update_authenticated" on public.purchase_request_items
  for update using (auth.role() = 'authenticated');
create policy "purchase_request_items_delete_authenticated" on public.purchase_request_items
  for delete using (auth.role() = 'authenticated');

-- 구매요청 + 품목을 원자적으로 생성한다(create_quote_with_items와 동일한 패턴).
create or replace function public.create_purchase_request_with_items(
  p_supplier_id uuid,
  p_request_date date,
  p_memo text,
  p_items jsonb
)
returns uuid
language plpgsql
as $$
declare
  v_id uuid;
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;

  insert into public.purchase_requests (supplier_id, request_date, memo, requested_by)
  values (p_supplier_id, p_request_date, p_memo, v_actor)
  returning id into v_id;

  if jsonb_array_length(p_items) > 0 then
    insert into public.purchase_request_items
      (purchase_request_id, product_id, custom_name, spec, quantity, estimated_unit_price, remark)
    select
      v_id,
      nullif(item->>'productId', '')::uuid,
      nullif(item->>'customName', ''),
      nullif(item->>'spec', ''),
      (item->>'quantity')::numeric,
      coalesce((item->>'estimatedUnitPrice')::numeric, 0),
      nullif(item->>'remark', '')
    from jsonb_array_elements(p_items) as item;
  end if;

  return v_id;
end;
$$;

-- 제출(마감) — 다 쓴 초안에 결재선을 붙여 결재를 시작한다
-- (submit_leave_request와 동일한 1회성 결재 패턴). 품목이 하나도 없는
-- 빈 요청은 제출할 수 없다.
create or replace function public.submit_purchase_request(
  p_id uuid,
  p_approver_ids uuid[],
  p_reference_ids uuid[] default '{}'
)
returns uuid
language plpgsql
as $$
declare
  v_actor uuid := auth.uid();
  v_owner uuid;
  v_status text;
  v_supplier_name text;
  v_item_count integer;
  v_total numeric;
  v_doc_id uuid;
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;
  if p_approver_ids is null or array_length(p_approver_ids, 1) is null then
    raise exception '결재선(승인자)을 1명 이상 지정해주세요.';
  end if;

  select pr.requested_by, pr.status, s.name
    into v_owner, v_status, v_supplier_name
  from public.purchase_requests pr
  join public.suppliers s on s.id = pr.supplier_id
  where pr.id = p_id;

  if v_owner is null then
    raise exception '구매요청을 찾을 수 없습니다.';
  end if;
  if v_owner is distinct from v_actor and not public.is_admin() then
    raise exception '본인이 작성한 구매요청만 제출할 수 있습니다.';
  end if;
  if v_status is distinct from 'draft' then
    raise exception '임시 작성 상태의 구매요청만 제출할 수 있습니다.';
  end if;

  select count(*), coalesce(sum(quantity * estimated_unit_price), 0) into v_item_count, v_total
  from public.purchase_request_items where purchase_request_id = p_id;
  if v_item_count = 0 then
    raise exception '품목이 없는 구매요청은 제출할 수 없습니다.';
  end if;

  v_doc_id := public.submit_approval_document(
    coalesce(v_supplier_name, '공급처미지정') || ' 구매요청 (예상 ' || v_total || '원)',
    '품목 ' || v_item_count || '건, 예상 합계 ' || v_total || '원',
    p_approver_ids,
    p_reference_ids
  );

  update public.purchase_requests
  set status = 'pending', approval_document_id = v_doc_id
  where id = p_id;

  return v_doc_id;
end;
$$;

-- 제출을 회수한다 — 아직 아무도 결재하지 않은 경우에만
-- (recall_approval_document가 검증) 허용하고, 회수되면 다시 draft로
-- 돌아가 계속 작성할 수 있다.
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
  from public.purchase_requests where id = p_id;

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

revoke all on function public.submit_purchase_request(uuid, uuid[], uuid[]) from public;
grant execute on function public.submit_purchase_request(uuid, uuid[], uuid[]) to authenticated;
revoke all on function public.recall_purchase_request(uuid) from public;
grant execute on function public.recall_purchase_request(uuid) to authenticated;

-- 결재가 끝나면 구매요청 상태에도 그대로 반영한다
-- (sync_leave_request_from_approval과 동일한 패턴).
create or replace function public.sync_purchase_request_from_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_decided_by uuid;
begin
  if new.status not in ('approved', 'rejected') or new.status = old.status then
    return new;
  end if;

  select decided_by into v_decided_by
  from public.approval_steps
  where document_id = new.id and role = 'approver' and decided_by is not null
  order by step_order desc
  limit 1;

  update public.purchase_requests
  set status = new.status, decided_at = new.decided_at, decided_by = v_decided_by
  where approval_document_id = new.id and status = 'pending';

  return new;
end;
$$;

drop trigger if exists sync_purchase_request_from_approval_trigger on public.approval_documents;
create trigger sync_purchase_request_from_approval_trigger
  after update on public.approval_documents
  for each row execute procedure public.sync_purchase_request_from_approval();
