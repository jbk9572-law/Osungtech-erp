-- Osungtech ERP: 재고관리 초기 스키마
-- profiles: auth.users 확장 (이름, 역할)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  role text not null default 'staff' check (role in ('admin', 'manager', 'staff')),
  created_at timestamptz not null default now()
);

-- 신규 가입 시 profiles row 자동 생성
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 상품 카테고리
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz not null default now()
);

-- 공급업체
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text,
  email text,
  phone text,
  address text,
  created_at timestamptz not null default now()
);

-- 창고/지점
create table if not exists public.warehouses (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  location text,
  created_at timestamptz not null default now()
);

-- 상품
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,
  description text,
  category_id uuid references public.categories (id) on delete set null,
  supplier_id uuid references public.suppliers (id) on delete set null,
  unit text not null default 'ea',
  price numeric(12, 2) not null default 0,
  cost numeric(12, 2) not null default 0,
  reorder_point integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 창고별 재고 수량
create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  warehouse_id uuid not null references public.warehouses (id) on delete cascade,
  quantity integer not null default 0 check (quantity >= 0),
  updated_at timestamptz not null default now(),
  unique (product_id, warehouse_id)
);

-- 입출고/조정 트랜잭션 (재고 변경 이력)
create table if not exists public.inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  warehouse_id uuid not null references public.warehouses (id) on delete cascade,
  type text not null check (type in ('in', 'out', 'adjustment')),
  quantity integer not null check (quantity <> 0),
  reference text,
  note text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- 트랜잭션 등록 시 inventory 수량 반영
create or replace function public.apply_inventory_transaction()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  delta integer;
begin
  delta := case
    when new.type = 'out' then -abs(new.quantity)
    else new.quantity
  end;

  insert into public.inventory (product_id, warehouse_id, quantity, updated_at)
  values (new.product_id, new.warehouse_id, delta, now())
  on conflict (product_id, warehouse_id)
  do update set
    quantity = public.inventory.quantity + excluded.quantity,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_inventory_transaction_created on public.inventory_transactions;
create trigger on_inventory_transaction_created
  after insert on public.inventory_transactions
  for each row execute procedure public.apply_inventory_transaction();

-- updated_at 자동 갱신
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_products_updated_at on public.products;
create trigger set_products_updated_at
  before update on public.products
  for each row execute procedure public.set_updated_at();
