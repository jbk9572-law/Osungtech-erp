-- 생산관리(BOM/생산지시) 1차 범위(MRP-lite) 스키마.
--
-- 범위는 판매용 로드맵 설계안에서 합의한 대로: 단일 레벨 BOM(완제품 1개
-- = 구성품 여러 개, 구성품 자체가 다시 BOM을 갖는 다단계는 아직 없음) +
-- "즉시 처리" 생산지시(작업 대기/진행 상태 없이, 등록하는 순간 바로
-- 구성품을 소모하고 완제품을 입고 처리) — 매출/매입 등록 RPC가 재고
-- 이력을 남기는 것과 완전히 같은 엔진(inventory_transactions)을
-- 재사용한다. 이 마이그레이션은 098/099(멀티테넌트 전환)가 이미 적용된
-- 뒤에 실행한다는 전제로, 새로 만드는 두 테이블은 처음부터 tenant_id를
-- 갖고 태어난다(기존 테이블처럼 나중에 백필할 필요가 없다).

create table if not exists public.bom_items (
  id uuid primary key default gen_random_uuid(),
  parent_product_id uuid not null references public.products (id) on delete cascade,
  component_product_id uuid not null references public.products (id) on delete restrict,
  -- 완제품 1개를 만드는 데 필요한 구성품 수량.
  quantity_per_unit numeric not null check (quantity_per_unit > 0),
  created_at timestamptz not null default now(),
  is_demo boolean not null default public.is_demo_actor(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  constraint bom_items_no_self_reference check (parent_product_id <> component_product_id),
  unique (parent_product_id, component_product_id)
);

create index if not exists bom_items_parent_idx on public.bom_items (parent_product_id);
create index if not exists bom_items_tenant_id_idx on public.bom_items (tenant_id);

alter table public.bom_items enable row level security;

-- 품목관리 화면에서 다루는 부속 데이터라 나머지 마스터데이터 테이블과
-- 같은 패턴(로그인한 사용자면 조회/등록/수정/삭제 가능).
create policy "bom_items_select_authenticated" on public.bom_items
  for select using (auth.role() = 'authenticated');
create policy "bom_items_insert_authenticated" on public.bom_items
  for insert with check (auth.role() = 'authenticated');
create policy "bom_items_update_authenticated" on public.bom_items
  for update using (auth.role() = 'authenticated');
create policy "bom_items_delete_authenticated" on public.bom_items
  for delete using (auth.role() = 'authenticated');

create policy "bom_items_demo_isolation" on public.bom_items
  as restrictive
  for all
  using (is_demo = public.is_demo_actor())
  with check (is_demo = public.is_demo_actor());
create policy "bom_items_tenant_isolation" on public.bom_items
  as restrictive
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create sequence if not exists public.work_orders_doc_no_seq;

create table if not exists public.work_orders (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete restrict,
  warehouse_id uuid not null references public.warehouses (id) on delete restrict,
  quantity numeric not null check (quantity > 0),
  order_date date not null,
  memo text,
  doc_no bigint not null default nextval('public.work_orders_doc_no_seq'),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  is_demo boolean not null default public.is_demo_actor(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id)
);

create index if not exists work_orders_order_date_idx on public.work_orders (order_date desc);
create index if not exists work_orders_tenant_id_idx on public.work_orders (tenant_id);

alter table public.work_orders enable row level security;

-- 매출/매입 주문과 같은 패턴: 조회/등록은 로그인한 누구나, 수정/삭제는
-- 본인이 등록한 것 또는 관리자만(migration 70 owner_or_admin과 동일).
create policy "work_orders_select_authenticated" on public.work_orders
  for select using (auth.role() = 'authenticated');
create policy "work_orders_insert_authenticated" on public.work_orders
  for insert with check (auth.role() = 'authenticated');
create policy "work_orders_update_owner_or_admin" on public.work_orders
  for update using (created_by = auth.uid() or public.is_admin());
create policy "work_orders_delete_owner_or_admin" on public.work_orders
  for delete using (created_by = auth.uid() or public.is_admin());

create policy "work_orders_demo_isolation" on public.work_orders
  as restrictive
  for all
  using (is_demo = public.is_demo_actor())
  with check (is_demo = public.is_demo_actor());
create policy "work_orders_tenant_isolation" on public.work_orders
  as restrictive
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- create_sale_with_items()/create_purchase_with_items()와 완전히 같은
-- 방식(security definer가 아님 — auth.uid()가 실제 호출자 그대로
-- 유지되어, is_demo/tenant_id 둘 다 각 insert의 컬럼 기본값만으로 저절로
-- 올바르게 채워진다. 이 함수 안에서 명시적으로 다룰 필요가 없다).
create or replace function public.create_work_order(
  p_product_id uuid,
  p_warehouse_id uuid,
  p_quantity numeric,
  p_order_date date,
  p_memo text default null,
  p_doc_no bigint default null
)
returns uuid
language plpgsql
as $$
declare
  v_order_id uuid;
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception '생산 수량은 0보다 커야 합니다.';
  end if;
  if not exists (select 1 from public.bom_items where parent_product_id = p_product_id) then
    raise exception '이 품목에 등록된 BOM(구성품)이 없습니다. 먼저 품목관리에서 BOM을 등록해주세요.';
  end if;

  insert into public.work_orders (product_id, warehouse_id, quantity, order_date, memo, doc_no, created_by)
  values (
    p_product_id, p_warehouse_id, p_quantity, p_order_date, p_memo,
    coalesce(p_doc_no, nextval('public.work_orders_doc_no_seq')), v_actor
  )
  returning id into v_order_id;

  -- 구성품 소모(출고 처리) — BOM 줄마다 (단위당 소요량 × 생산수량).
  insert into public.inventory_transactions (product_id, warehouse_id, type, quantity, reference, created_by)
  select component_product_id, p_warehouse_id, 'out', quantity_per_unit * p_quantity,
         'work_order:' || v_order_id, v_actor
  from public.bom_items
  where parent_product_id = p_product_id;

  -- 완제품 생산(입고 처리).
  insert into public.inventory_transactions (product_id, warehouse_id, type, quantity, reference, created_by)
  values (p_product_id, p_warehouse_id, 'in', p_quantity, 'work_order:' || v_order_id, v_actor);

  return v_order_id;
end;
$$;

-- update_sale_with_items()의 되돌리기(reversal) 방식과 동일 — 지금
-- 등록돼 있는 BOM 기준으로 반대 방향 재고 이력을 남긴 뒤 생산지시 자체를
-- 지운다. (생산 시점 이후 BOM이 바뀌었다면 그 시점 그대로가 아니라
-- "현재" BOM 기준으로 되돌리는 점은 update_sale_with_items가 현재
-- sales_order_items 기준으로 되돌리는 것과 같은 한계이며, 새로 도입한
-- 제약이 아니다.)
create or replace function public.delete_work_order(p_id uuid)
returns void
language plpgsql
as $$
declare
  v_actor uuid := auth.uid();
  v_owner uuid;
  v_warehouse_id uuid;
  v_product_id uuid;
  v_quantity numeric;
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;

  select created_by, warehouse_id, product_id, quantity
    into v_owner, v_warehouse_id, v_product_id, v_quantity
  from public.work_orders where id = p_id;

  if v_warehouse_id is null then
    raise exception '생산지시를 찾을 수 없습니다.';
  end if;
  if v_owner is distinct from v_actor and not public.is_admin() then
    raise exception '본인이 등록한 생산지시만 삭제할 수 있습니다.';
  end if;

  insert into public.inventory_transactions (product_id, warehouse_id, type, quantity, reference, created_by)
  select component_product_id, v_warehouse_id, 'in', quantity_per_unit * v_quantity,
         'work_order_reversal:' || p_id, v_actor
  from public.bom_items
  where parent_product_id = v_product_id;

  insert into public.inventory_transactions (product_id, warehouse_id, type, quantity, reference, created_by)
  values (v_product_id, v_warehouse_id, 'out', v_quantity, 'work_order_reversal:' || p_id, v_actor);

  delete from public.work_orders where id = p_id;
end;
$$;
