import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";

// 재고/원가(FIFO)·삭제·수정 같은 핵심 처리는 앱 코드가 아니라 DB 함수(PL/pgSQL)
// 안에 있어서 지금까지 실행해 보는 테스트가 없었다 — 그래서 "동시등록 매입이
// 영구히 삭제 안 됨" 같은 사고를 운영에서야 발견했다. 이 하네스는 메모리 안의
// 가상 Postgres(pglite)에 최소한의 테이블 뼈대만 만들고, **실제 마이그레이션
// 파일에서 함수 정의를 그대로 읽어와서**(파일별로 가장 마지막 정의가 최종본)
// 올려 실행해 본다 — 테스트용으로 따로 베껴 쓴 SQL이 아니라 운영에 나가는
// 바로 그 SQL을 검증한다. 마이그레이션 전체(229개)를 다 적용하지 않는 이유:
// Supabase 전용 구문(auth/storage 스키마, 확장, 크론 등)이 섞여 있어 순정
// Postgres에서는 안 돌기 때문이다 — 대신 함수가 의존하는 테이블/보조함수만
// 이 파일에서 최소로 재현한다(운영 스키마와 컬럼이 어긋나면 함수 실행 때 바로
// 에러가 나므로 어긋남도 이 테스트가 잡는다).

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");

// 테스트가 검증하는 함수들 — 운영 마이그레이션에서 최종 정의를 가져온다.
const FUNCTIONS_UNDER_TEST = [
  "consume_fifo_layers",
  "release_fifo_consumption",
  "backfill_fifo_consumption_for_purchase",
  "create_sale_with_items",
  "update_sale_with_items",
  "delete_sale_with_items",
  "create_purchase_with_items",
  "update_purchase_with_items",
  "purchase_lot_consumers_text",
  "delete_purchase_with_items",
  "create_purchase_and_sale_with_items",
];

function latestFunctionSql(name: string): string {
  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
  let latest: string | null = null;
  const re = new RegExp(`create or replace function public\\.${name}\\(`, "g");
  for (const file of files) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((m = re.exec(sql))) {
      const end = sql.indexOf("$$;", m.index);
      if (end === -1) continue;
      latest = sql.slice(m.index, end + 3);
    }
  }
  if (!latest) throw new Error(`마이그레이션에서 함수 ${name}를 찾지 못했습니다.`);
  return latest;
}

const SCHEMA_SQL = `
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create or replace function auth.role() returns text language sql stable as $$ select 'authenticated' $$;

create table public.tenants (id uuid primary key default gen_random_uuid(), closing_date date);
create table public.profiles (id uuid primary key, role text not null default 'staff');
create table public.tenant_members (user_id uuid primary key, tenant_id uuid not null references public.tenants(id));
create table public.platform_admin_impersonations (admin_user_id uuid, tenant_id uuid, ended_at timestamptz);

create function public.current_tenant_id() returns uuid language sql stable as $$
  select (select tenant_id from public.tenant_members where user_id = auth.uid())
$$;
create function public.is_admin() returns boolean language sql stable as $$
  select exists (select 1 from public.profiles me where me.id = auth.uid() and me.role = 'admin')
$$;
create function public.is_demo_actor() returns boolean language sql stable as $$ select false $$;

create table public.warehouses (id uuid primary key default gen_random_uuid(), name text not null default 'W');
create table public.customers (id uuid primary key default gen_random_uuid(), name text not null default 'C');
create table public.suppliers (id uuid primary key default gen_random_uuid(), name text not null default 'S');
create table public.products (
  id uuid primary key default gen_random_uuid(),
  sku text, name text not null default 'P',
  cost numeric not null default 0,
  parent_product_id uuid references public.products(id)
);

create sequence public.purchase_orders_doc_no_seq;
create sequence public.sales_orders_doc_no_seq;

create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid, warehouse_id uuid, purchase_date date, memo text, created_by uuid,
  payment_method text, delivery_method text, doc_no bigint, tax_type text, evidence_type text,
  is_carryover boolean not null default false,
  tenant_id uuid default public.current_tenant_id()
);
create table public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  product_id uuid, custom_name text, spec text,
  quantity numeric not null, unit_cost numeric not null default 0,
  remark text, lot_number text,
  remaining_quantity numeric not null default 0,
  created_at timestamptz not null default now(),
  tenant_id uuid default public.current_tenant_id(),
  constraint purchase_order_items_remaining_quantity_check
    check (remaining_quantity >= 0 and remaining_quantity <= quantity)
);
create table public.sales_orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid, warehouse_id uuid, order_date date, memo text, created_by uuid,
  payment_method text, delivery_method text, doc_no bigint,
  is_return boolean not null default false, return_reason text,
  is_carryover boolean not null default false, tax_type text, evidence_type text,
  is_sample boolean not null default false,
  tenant_id uuid default public.current_tenant_id()
);
create table public.sales_order_items (
  id uuid primary key default gen_random_uuid(),
  sales_order_id uuid not null references public.sales_orders(id) on delete cascade,
  product_id uuid, custom_name text, spec text,
  quantity numeric not null, unit_price numeric not null default 0, unit_cost numeric not null default 0,
  remark text, lot_number text,
  created_at timestamptz not null default now(),
  tenant_id uuid default public.current_tenant_id()
);
create table public.fifo_consumptions (
  id uuid primary key default gen_random_uuid(),
  purchase_order_item_id uuid not null references public.purchase_order_items(id) on delete restrict,
  consumed_quantity numeric not null check (consumed_quantity > 0),
  consumed_unit_cost numeric not null,
  consumed_by_type text not null check (consumed_by_type in ('sale','loss')),
  sales_order_item_id uuid references public.sales_order_items(id) on delete cascade,
  loss_product_id uuid, loss_warehouse_id uuid, note text, created_by uuid,
  created_at timestamptz not null default now(),
  is_demo boolean not null default public.is_demo_actor(),
  tenant_id uuid not null default public.current_tenant_id()
);
create table public.inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid, warehouse_id uuid, type text, quantity numeric, reference text,
  sales_order_id uuid, purchase_order_id uuid, created_by uuid,
  created_at timestamptz not null default now(),
  tenant_id uuid default public.current_tenant_id()
);
`;

export type Harness = {
  db: PGlite;
  /** 테스트 사용자(관리자/일반)로 로그인한 상태로 쿼리를 실행한다. */
  as: (userId: string) => Promise<void>;
  ids: { tenant: string; admin: string; staff: string; warehouse: string; customer: string; supplier: string };
  makeProduct: (opts?: { name?: string; cost?: number; parent?: string }) => Promise<string>;
};

export async function createHarness(): Promise<Harness> {
  const db = new PGlite();
  await db.exec(SCHEMA_SQL);
  for (const name of FUNCTIONS_UNDER_TEST) {
    await db.exec(latestFunctionSql(name));
  }

  const ids = {
    tenant: crypto.randomUUID(),
    admin: crypto.randomUUID(),
    staff: crypto.randomUUID(),
    warehouse: crypto.randomUUID(),
    customer: crypto.randomUUID(),
    supplier: crypto.randomUUID(),
  };
  await db.exec(`
    insert into public.tenants (id) values ('${ids.tenant}');
    insert into public.profiles (id, role) values ('${ids.admin}', 'admin'), ('${ids.staff}', 'staff');
    insert into public.tenant_members (user_id, tenant_id) values ('${ids.admin}', '${ids.tenant}'), ('${ids.staff}', '${ids.tenant}');
    insert into public.warehouses (id) values ('${ids.warehouse}');
    insert into public.customers (id) values ('${ids.customer}');
    insert into public.suppliers (id) values ('${ids.supplier}');
  `);

  const as = async (userId: string) => {
    await db.exec(`select set_config('request.jwt.claim.sub', '${userId}', false)`);
  };
  await as(ids.staff);

  async function makeProduct(opts: { name?: string; cost?: number; parent?: string } = {}) {
    const res = await db.query<{ id: string }>(
      `insert into public.products (name, cost, parent_product_id) values ($1, $2, $3) returning id`,
      [opts.name ?? "P", opts.cost ?? 0, opts.parent ?? null],
    );
    return res.rows[0].id;
  }

  return { db, as, ids, makeProduct };
}
