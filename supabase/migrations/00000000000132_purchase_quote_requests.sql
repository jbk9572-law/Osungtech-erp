-- 구매 견적요청(RFQ) — 영업 쪽 견적서관리(quotes, migration 128)의 반대
-- 방향. 지금까지는 구매요청/구매발주 모두 "얼마에 살지"를 이미 정하고
-- 시작했는데, 실제로는 여러 공급처에 먼저 견적을 받아 비교한 뒤 결정하는
-- 경우가 많다. 이 견적요청 자체는 승인 절차가 없다(내부용 비교 도구일
-- 뿐이라 결재까지 탈 필요는 없음) — 비교가 끝나 공급처를 확정하면 이미
-- 있는 구매요청(purchase_requests, migration 130)으로 전환해 그 승인
-- 워크플로우를 그대로 이어 탄다.

create table public.purchase_quote_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  request_date date not null default current_date,
  memo text,
  status text not null default 'open' check (status in ('open', 'closed')),
  -- 견적을 받을 공급처 목록. 아직 가격을 안 넣은 공급처도 비교 표에
  -- 빈 칸으로 보여줘야 해서(누구에게 요청했는지 자체가 정보), 실제
  -- 가격이 들어온 공급처만 알 수 있는 purchase_quote_prices와 별도로
  -- 대상 목록을 들고 있는다.
  target_supplier_ids uuid[] not null default '{}',
  selected_supplier_id uuid references public.suppliers (id) on delete set null,
  converted_purchase_request_id uuid references public.purchase_requests (id) on delete set null,
  is_demo boolean not null default public.is_demo_actor(),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index purchase_quote_requests_tenant_id_idx on public.purchase_quote_requests (tenant_id);

alter table public.purchase_quote_requests enable row level security;

create policy "purchase_quote_requests_tenant_isolation" on public.purchase_quote_requests
  as restrictive
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy "purchase_quote_requests_demo_isolation" on public.purchase_quote_requests
  as restrictive
  for all
  using (is_demo = public.is_demo_actor())
  with check (is_demo = public.is_demo_actor());

create policy "purchase_quote_requests_select_authenticated" on public.purchase_quote_requests
  for select using (auth.role() = 'authenticated');
create policy "purchase_quote_requests_insert_authenticated" on public.purchase_quote_requests
  for insert with check (auth.role() = 'authenticated');
create policy "purchase_quote_requests_update_authenticated" on public.purchase_quote_requests
  for update using (auth.role() = 'authenticated');
create policy "purchase_quote_requests_delete_authenticated" on public.purchase_quote_requests
  for delete using (auth.role() = 'authenticated');

create table public.purchase_quote_request_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  purchase_quote_request_id uuid not null references public.purchase_quote_requests (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  custom_name text,
  spec text,
  quantity numeric not null,
  remark text,
  is_demo boolean not null default public.is_demo_actor(),
  created_at timestamptz not null default now()
);

create index purchase_quote_request_items_request_id_idx on public.purchase_quote_request_items (purchase_quote_request_id);
create index purchase_quote_request_items_tenant_id_idx on public.purchase_quote_request_items (tenant_id);

alter table public.purchase_quote_request_items enable row level security;

create policy "purchase_quote_request_items_tenant_isolation" on public.purchase_quote_request_items
  as restrictive
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy "purchase_quote_request_items_demo_isolation" on public.purchase_quote_request_items
  as restrictive
  for all
  using (is_demo = public.is_demo_actor())
  with check (is_demo = public.is_demo_actor());

create policy "purchase_quote_request_items_select_authenticated" on public.purchase_quote_request_items
  for select using (auth.role() = 'authenticated');
create policy "purchase_quote_request_items_insert_authenticated" on public.purchase_quote_request_items
  for insert with check (auth.role() = 'authenticated');
create policy "purchase_quote_request_items_delete_authenticated" on public.purchase_quote_request_items
  for delete using (auth.role() = 'authenticated');

-- 품목 x 공급처 조합별 견적가 — 비교표의 각 칸 하나에 대응한다.
create table public.purchase_quote_prices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  purchase_quote_request_id uuid not null references public.purchase_quote_requests (id) on delete cascade,
  purchase_quote_request_item_id uuid not null references public.purchase_quote_request_items (id) on delete cascade,
  supplier_id uuid not null references public.suppliers (id) on delete cascade,
  unit_price numeric not null default 0,
  remark text,
  is_demo boolean not null default public.is_demo_actor(),
  created_at timestamptz not null default now(),
  unique (purchase_quote_request_item_id, supplier_id)
);

create index purchase_quote_prices_request_id_idx on public.purchase_quote_prices (purchase_quote_request_id);
create index purchase_quote_prices_tenant_id_idx on public.purchase_quote_prices (tenant_id);

alter table public.purchase_quote_prices enable row level security;

create policy "purchase_quote_prices_tenant_isolation" on public.purchase_quote_prices
  as restrictive
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy "purchase_quote_prices_demo_isolation" on public.purchase_quote_prices
  as restrictive
  for all
  using (is_demo = public.is_demo_actor())
  with check (is_demo = public.is_demo_actor());

create policy "purchase_quote_prices_select_authenticated" on public.purchase_quote_prices
  for select using (auth.role() = 'authenticated');
create policy "purchase_quote_prices_insert_authenticated" on public.purchase_quote_prices
  for insert with check (auth.role() = 'authenticated');
create policy "purchase_quote_prices_update_authenticated" on public.purchase_quote_prices
  for update using (auth.role() = 'authenticated');

-- 견적요청 + 품목 + 대상 공급처 목록을 원자적으로 생성한다
-- (create_quote_with_items와 동일한 패턴).
create or replace function public.create_purchase_quote_request_with_items(
  p_supplier_ids uuid[],
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
  if p_supplier_ids is null or array_length(p_supplier_ids, 1) is null then
    raise exception '견적을 받을 공급처를 1곳 이상 선택해주세요.';
  end if;

  insert into public.purchase_quote_requests (target_supplier_ids, request_date, memo, created_by)
  values (p_supplier_ids, p_request_date, p_memo, v_actor)
  returning id into v_id;

  if jsonb_array_length(p_items) > 0 then
    insert into public.purchase_quote_request_items (purchase_quote_request_id, product_id, custom_name, spec, quantity, remark)
    select
      v_id,
      nullif(item->>'productId', '')::uuid,
      nullif(item->>'customName', ''),
      nullif(item->>'spec', ''),
      (item->>'quantity')::numeric,
      nullif(item->>'remark', '')
    from jsonb_array_elements(p_items) as item;
  end if;

  return v_id;
end;
$$;

-- 한 공급처가 준 견적가를 한 번에 저장한다(품목별로 한 행씩) —
-- update_payment_request_with_items와 동일한 "지우고 다시 넣기" 패턴.
create or replace function public.set_purchase_quote_prices(
  p_purchase_quote_request_id uuid,
  p_supplier_id uuid,
  p_items jsonb
)
returns void
language plpgsql
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;

  delete from public.purchase_quote_prices
  where purchase_quote_request_id = p_purchase_quote_request_id and supplier_id = p_supplier_id;

  if jsonb_array_length(p_items) > 0 then
    insert into public.purchase_quote_prices
      (purchase_quote_request_id, purchase_quote_request_item_id, supplier_id, unit_price, remark)
    select
      p_purchase_quote_request_id,
      (item->>'itemId')::uuid,
      p_supplier_id,
      (item->>'unitPrice')::numeric,
      nullif(item->>'remark', '')
    from jsonb_array_elements(p_items) as item
    where (item->>'unitPrice')::numeric > 0;
  end if;
end;
$$;

-- 공급처를 확정하고, 그 공급처가 매긴 단가 그대로 구매요청(migration
-- 130)으로 전환한다 — quotes의 convertQuoteToSale과 같은 "다시 입력할
-- 필요 없이 그대로 넘긴다" 원칙이지만, 단가 매핑(품목 x 공급처 -> 단가)이
-- 얽혀 있어 여기서는 SQL 함수로 처리한다(앱 서버 액션 쪽은 단순 호출만).
-- 그 공급처가 값을 안 넣은 품목은 0원으로 넘어가며, 이후 구매요청
-- 화면에서 그대로 고칠 수 있다.
create or replace function public.convert_purchase_quote_request(
  p_id uuid,
  p_supplier_id uuid
)
returns uuid
language plpgsql
as $$
declare
  v_actor uuid := auth.uid();
  v_status text;
  v_target_supplier_ids uuid[];
  v_request_id uuid;
  v_items jsonb;
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;

  select status, target_supplier_ids into v_status, v_target_supplier_ids
  from public.purchase_quote_requests where id = p_id;

  if v_status is null then
    raise exception '견적요청을 찾을 수 없습니다.';
  end if;
  if v_status <> 'open' then
    raise exception '이미 처리된 견적요청입니다.';
  end if;
  if not (p_supplier_id = any(v_target_supplier_ids)) then
    raise exception '견적을 요청하지 않은 공급처입니다.';
  end if;

  select jsonb_agg(jsonb_build_object(
    'productId', i.product_id,
    'customName', i.custom_name,
    'spec', i.spec,
    'quantity', i.quantity,
    'estimatedUnitPrice', coalesce(pr.unit_price, 0),
    'remark', i.remark
  ))
  into v_items
  from public.purchase_quote_request_items i
  left join public.purchase_quote_prices pr
    on pr.purchase_quote_request_item_id = i.id and pr.supplier_id = p_supplier_id
  where i.purchase_quote_request_id = p_id;

  v_request_id := public.create_purchase_request_with_items(p_supplier_id, current_date, '견적요청에서 전환', coalesce(v_items, '[]'::jsonb));

  update public.purchase_quote_requests
  set status = 'closed', selected_supplier_id = p_supplier_id, converted_purchase_request_id = v_request_id
  where id = p_id;

  return v_request_id;
end;
$$;
