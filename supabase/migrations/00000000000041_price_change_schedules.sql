-- 거래처별 판매단가 인상/인하를 미리 예약해두는 기능. customer_product_prices는
-- "거래처+상품당 최신 단가 하나"만 남기는 구조라 미래 가격을 미리 넣어두면
-- 그 사이 판매에도 잘못 적용되므로, 예약은 별도 테이블에 쌓아두고 효력일이
-- 되면(그날 이후 조회 시점에) customer_product_prices에 반영한다.
create table if not exists public.price_change_schedules (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  new_unit_price numeric(12, 2) not null,
  effective_date date not null,
  applied_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists price_change_schedules_pending_idx
  on public.price_change_schedules (customer_id, product_id, effective_date)
  where applied_at is null;

alter table public.price_change_schedules enable row level security;

drop policy if exists "price_change_schedules_select_authenticated" on public.price_change_schedules;
create policy "price_change_schedules_select_authenticated" on public.price_change_schedules
  for select using (auth.role() = 'authenticated');
drop policy if exists "price_change_schedules_insert_authenticated" on public.price_change_schedules;
create policy "price_change_schedules_insert_authenticated" on public.price_change_schedules
  for insert with check (auth.role() = 'authenticated');
drop policy if exists "price_change_schedules_update_authenticated" on public.price_change_schedules;
create policy "price_change_schedules_update_authenticated" on public.price_change_schedules
  for update using (auth.role() = 'authenticated');
drop policy if exists "price_change_schedules_delete_authenticated" on public.price_change_schedules;
create policy "price_change_schedules_delete_authenticated" on public.price_change_schedules
  for delete using (auth.role() = 'authenticated');
