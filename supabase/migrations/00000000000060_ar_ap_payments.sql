-- 거래처별 외상잔액(미수금/미지급금) 관리. 매출/매입은 이미 등록돼 있으니
-- 새로 건드리지 않고, "수금"(고객에게 받은 돈)과 "지급"(공급처에 준 돈)만
-- 별도 원장으로 쌓는다. 잔액은 저장하지 않고 그때그때
-- (매출·매입 누계) - (수금·지급 누계)로 계산한다 — 매출/매입 데이터가
-- 나중에 수정/삭제돼도 잔액이 따로 안 맞는 문제가 없다.
create table if not exists public.customer_payments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  paid_at date not null,
  amount numeric not null,
  method text,
  memo text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists customer_payments_customer_id_idx
  on public.customer_payments (customer_id);

alter table public.customer_payments enable row level security;

drop policy if exists "customer_payments_select_authenticated" on public.customer_payments;
create policy "customer_payments_select_authenticated" on public.customer_payments
  for select using (auth.role() = 'authenticated');
drop policy if exists "customer_payments_insert_authenticated" on public.customer_payments;
create policy "customer_payments_insert_authenticated" on public.customer_payments
  for insert with check (auth.role() = 'authenticated');
drop policy if exists "customer_payments_delete_authenticated" on public.customer_payments;
create policy "customer_payments_delete_authenticated" on public.customer_payments
  for delete using (auth.role() = 'authenticated');

create table if not exists public.supplier_payments (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers (id) on delete cascade,
  paid_at date not null,
  amount numeric not null,
  method text,
  memo text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists supplier_payments_supplier_id_idx
  on public.supplier_payments (supplier_id);

alter table public.supplier_payments enable row level security;

drop policy if exists "supplier_payments_select_authenticated" on public.supplier_payments;
create policy "supplier_payments_select_authenticated" on public.supplier_payments
  for select using (auth.role() = 'authenticated');
drop policy if exists "supplier_payments_insert_authenticated" on public.supplier_payments;
create policy "supplier_payments_insert_authenticated" on public.supplier_payments
  for insert with check (auth.role() = 'authenticated');
drop policy if exists "supplier_payments_delete_authenticated" on public.supplier_payments;
create policy "supplier_payments_delete_authenticated" on public.supplier_payments
  for delete using (auth.role() = 'authenticated');
