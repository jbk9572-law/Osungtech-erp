-- 세금계산서 발행 — 지금까지는 sales_orders.invoice_status로 "발행했다/
-- 안했다"만 수기로 기록했고, 실제 세금계산서에 들어가는 내용(품목별
-- 공급가액/세액, 현금·수표·어음·외상미수금, 청구/영수 등)을 담는 곳이
-- 아예 없었다. 홈택스 전자세금계산서 입력 화면(세금계산서(영세율포함))과
-- 같은 항목 구성으로 기록해서, 나중에 홈택스 일괄발급 엑셀 양식을 받으면
-- 이미 가진 데이터를 그 열 순서로 재배열만 하면 되게 한다.
--
-- 거래명세표(명세표/출고증, sales_orders/sales_order_items)는 이 작업과
-- 완전히 별개다 — 건드리지 않는다. 세금계산서는 국세청에 신고하는 별도
-- 문서라 매출 건 하나에 물리는 독립된 레코드로 둔다(1 매출 건 = 최대
-- 1 세금계산서).

-- 공급받는자(거래처)의 업태/종목 — company_profile(우리 회사, 공급자)은
-- 이미 business_type/business_item을 갖고 있는데 customers/suppliers는
-- 없었다. 세금계산서 공급받는자 칸에 필요해서 추가하고, 매입 쪽에서도
-- 나중에 같은 식으로 쓸 수 있게 suppliers도 같이 맞춘다(partner-form.tsx
-- 공용 폼이라 한쪽만 추가하면 화면이 비대칭이 된다).
alter table public.customers add column if not exists business_type text;
alter table public.customers add column if not exists business_item text;
alter table public.suppliers add column if not exists business_type text;
alter table public.suppliers add column if not exists business_item text;

create table public.tax_invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  sales_order_id uuid not null unique references public.sales_orders (id) on delete cascade,
  customer_id uuid not null references public.customers (id),
  -- 홈택스 화면의 "종류" — 위수탁/위수탁영세는 이 회사가 안 쓸 것 같아
  -- 범위에서 뺐다(나중에 필요해지면 체크 제약만 늘리면 된다).
  invoice_type text not null default 'general' check (invoice_type in ('general', 'zero_rate')),
  issue_date date not null,
  supply_amount numeric not null default 0,
  tax_amount numeric not null default 0,
  total_amount numeric not null default 0,
  -- 현금/수표/어음/외상미수금 — 홈택스 화면 하단 결제 수단 구분 그대로.
  cash_amount numeric not null default 0,
  check_amount numeric not null default 0,
  note_amount numeric not null default 0,
  credit_amount numeric not null default 0,
  claim_type text not null default 'claim' check (claim_type in ('claim', 'receipt')),
  remark text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  is_demo boolean not null default public.is_demo_actor(),
  updated_at timestamptz not null default now()
);

create index tax_invoices_tenant_id_idx on public.tax_invoices (tenant_id);
create index tax_invoices_customer_id_idx on public.tax_invoices (customer_id);

create table public.tax_invoice_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  tax_invoice_id uuid not null references public.tax_invoices (id) on delete cascade,
  -- 홈택스 품목 줄은 세금계산서 작성일자와 별개로 줄마다 월/일을 가질 수
  -- 있다(한 장에 여러 날짜 품목을 묶어 발행하는 경우) — 연도는 작성일자를
  -- 따르므로 월/일만 쓰는 홈택스와 달리 여기선 date로 통째로 저장하고
  -- 화면에서 월/일만 보여준다.
  line_date date,
  item_name text not null,
  spec text,
  quantity numeric,
  unit_price numeric,
  supply_amount numeric not null default 0,
  tax_amount numeric not null default 0,
  remark text,
  sort_order integer not null default 0,
  is_demo boolean not null default public.is_demo_actor()
);

create index tax_invoice_items_tenant_id_idx on public.tax_invoice_items (tenant_id);
create index tax_invoice_items_tax_invoice_id_idx on public.tax_invoice_items (tax_invoice_id);

alter table public.tax_invoices enable row level security;
alter table public.tax_invoice_items enable row level security;

-- sales_orders/sales_order_items와 동일한 패턴: 조회/등록은 로그인한
-- 누구나, 수정/삭제는 작성자 본인이거나 관리자만.
create policy "tax_invoices_select_authenticated" on public.tax_invoices
  for select using (auth.role() = 'authenticated');
create policy "tax_invoices_insert_authenticated" on public.tax_invoices
  for insert with check (auth.role() = 'authenticated');
create policy "tax_invoices_update_owner_or_admin" on public.tax_invoices
  for update using (created_by = auth.uid() or public.is_admin());
create policy "tax_invoices_delete_owner_or_admin" on public.tax_invoices
  for delete using (created_by = auth.uid() or public.is_admin());

create policy "tax_invoices_demo_isolation" on public.tax_invoices
  as restrictive for all
  using (is_demo = public.is_demo_actor()) with check (is_demo = public.is_demo_actor());
create policy "tax_invoices_tenant_isolation" on public.tax_invoices
  as restrictive for all
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

create policy "tax_invoice_items_select_authenticated" on public.tax_invoice_items
  for select using (auth.role() = 'authenticated');
create policy "tax_invoice_items_insert_owner_or_admin" on public.tax_invoice_items
  for insert with check (
    exists (
      select 1 from public.tax_invoices ti
      where ti.id = tax_invoice_items.tax_invoice_id
        and (ti.created_by = auth.uid() or public.is_admin())
    )
  );
create policy "tax_invoice_items_update_owner_or_admin" on public.tax_invoice_items
  for update using (
    exists (
      select 1 from public.tax_invoices ti
      where ti.id = tax_invoice_items.tax_invoice_id
        and (ti.created_by = auth.uid() or public.is_admin())
    )
  );
create policy "tax_invoice_items_delete_owner_or_admin" on public.tax_invoice_items
  for delete using (
    exists (
      select 1 from public.tax_invoices ti
      where ti.id = tax_invoice_items.tax_invoice_id
        and (ti.created_by = auth.uid() or public.is_admin())
    )
  );

create policy "tax_invoice_items_demo_isolation" on public.tax_invoice_items
  as restrictive for all
  using (is_demo = public.is_demo_actor()) with check (is_demo = public.is_demo_actor());
create policy "tax_invoice_items_tenant_isolation" on public.tax_invoice_items
  as restrictive for all
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());
