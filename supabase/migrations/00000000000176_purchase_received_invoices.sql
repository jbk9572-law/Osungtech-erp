-- 매입세금계산서 수취관리 — 거래처(공급처)가 우리한테 발행한
-- 세금계산서를 추적한다. API 연동이 없어서(바로빌/팝빌 등 ASP 미계약),
-- 홈택스 [조회/발급 > 매입매출내역 조회] 화면에서 사람이 직접 다운로드한
-- 엑셀을 업로드하면 그 내용을 이 테이블에 저장하고 매입 건과 자동
-- 매칭한다 — 세금계산서 "발급" 쪽(tax_invoices, 엑셀 내보내기)과 정확히
-- 반대 방향(엑셀 "받아서" 들여오기).
--
-- 홈택스가 각 세금계산서에 부여하는 승인번호는 세금계산서 1건당
-- 고유해서, 같은 파일을 겹치는 기간으로 다시 올려도 승인번호 기준으로
-- 중복 저장되지 않게 막는다(unique 제약).
create table if not exists public.purchase_received_invoices (
  id uuid primary key default gen_random_uuid(),
  hometax_approval_number text not null,
  issue_date date not null,
  supplier_business_number text,
  supplier_name text not null,
  supply_amount numeric(14, 2) not null default 0,
  tax_amount numeric(14, 2) not null default 0,
  total_amount numeric(14, 2) not null default 0,
  item_summary text,
  purchase_order_id uuid references public.purchase_orders (id) on delete set null,
  matched_at timestamptz,
  imported_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  is_demo boolean not null default public.is_demo_actor(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  unique (tenant_id, hometax_approval_number)
);

create index if not exists purchase_received_invoices_issue_date_idx on public.purchase_received_invoices (issue_date desc);
create index if not exists purchase_received_invoices_purchase_order_id_idx on public.purchase_received_invoices (purchase_order_id);
create index if not exists purchase_received_invoices_tenant_id_idx on public.purchase_received_invoices (tenant_id);

alter table public.purchase_received_invoices enable row level security;

create policy "purchase_received_invoices_select_authenticated" on public.purchase_received_invoices
  for select using (auth.role() = 'authenticated');
create policy "purchase_received_invoices_insert_authenticated" on public.purchase_received_invoices
  for insert with check (auth.role() = 'authenticated');
create policy "purchase_received_invoices_update_authenticated" on public.purchase_received_invoices
  for update using (auth.role() = 'authenticated');
create policy "purchase_received_invoices_delete_authenticated" on public.purchase_received_invoices
  for delete using (auth.role() = 'authenticated');

create policy "purchase_received_invoices_demo_isolation" on public.purchase_received_invoices
  as restrictive
  for all
  using (is_demo = public.is_demo_actor())
  with check (is_demo = public.is_demo_actor());
create policy "purchase_received_invoices_tenant_isolation" on public.purchase_received_invoices
  as restrictive
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());
