-- 판매관리(거래처/거래명세표) 확장 스키마

-- 회사(공급자) 정보 - 거래명세표 발급용, 단일 행만 사용
create table if not exists public.company_profile (
  id integer primary key default 1,
  name text not null default '',
  business_number text,
  representative_name text,
  address text,
  business_type text,
  business_item text,
  phone text,
  updated_at timestamptz not null default now(),
  constraint company_profile_singleton check (id = 1)
);

insert into public.company_profile (id)
values (1)
on conflict (id) do nothing;

-- 거래처 (판매 대상 고객사)
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  business_number text,
  representative_name text,
  contact_name text,
  email text,
  phone text,
  address text,
  created_at timestamptz not null default now()
);

-- 거래처별 상품 판매단가 (거래처+상품당 최신 단가 하나만 유지)
create table if not exists public.customer_product_prices (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  unit_price numeric(12, 2) not null default 0,
  updated_at timestamptz not null default now(),
  unique (customer_id, product_id)
);

-- 판매 거래 (거래명세표 헤더)
create table if not exists public.sales_orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete restrict,
  warehouse_id uuid not null references public.warehouses (id) on delete restrict,
  order_date date not null default current_date,
  memo text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- 판매 거래 품목 (판매 시점의 수량/단가 스냅샷)
create table if not exists public.sales_order_items (
  id uuid primary key default gen_random_uuid(),
  sales_order_id uuid not null references public.sales_orders (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12, 2) not null default 0,
  created_at timestamptz not null default now()
);

-- 판매로 인한 출고를 재고 이력에서 추적하기 위한 연결 컬럼
alter table public.inventory_transactions
  add column if not exists sales_order_id uuid references public.sales_orders (id) on delete set null;

drop trigger if exists set_customer_product_prices_updated_at on public.customer_product_prices;
create trigger set_customer_product_prices_updated_at
  before update on public.customer_product_prices
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_company_profile_updated_at on public.company_profile;
create trigger set_company_profile_updated_at
  before update on public.company_profile
  for each row execute procedure public.set_updated_at();
