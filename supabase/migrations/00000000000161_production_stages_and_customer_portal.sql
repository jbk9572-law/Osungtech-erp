-- 1) 생산관리를 "즉시 처리"(자재투입=생산완료가 한 동작)에서 다단계
--    상태(대기→자재투입→완료)로 분리하고, 제품별 공정 순서(라우팅)를
--    정의해 생산지시마다 공정별 진행 체크리스트를 추적할 수 있게 한다.
-- 2) 거래처(customers)가 내부 직원 계정(profiles/tenant_members)과는
--    완전히 분리된 별도 포털 계정으로 로그인해 발주를 넣고, 직원이
--    검토·승인한 뒤 생산지시/매출로 전환되는 흐름 + 승인 후 진행
--    상태(생산중/생산완료/배송중/배송완료)를 조회만 할 수 있는 포털을
--    추가한다.
--
-- 보안 설계의 핵심: 포털 계정은 auth.users에는 올라가지만 profiles/
-- tenant_members에는 절대 들어가지 않는다(handle_new_user() 트리거를
-- 분기). 기존 "authenticated면 조회 가능" 류 정책들은 전부 그 위에
-- RESTRICTIVE tenant_isolation(tenant_id = current_tenant_id())이
-- 겹쳐 있어서, tenant_members가 없는 사용자는 current_tenant_id()가
-- null이 되어 모든 기존 테이블에서 자동으로 0건만 보인다(migration 99와
-- 완전히 같은 메커니즘, 데모 계정 격리와 같은 원리). 포털 전용 신규
-- 테이블에는 포털 계정을 위한 permissive 정책을 따로 추가하되, 상품
-- 카탈로그/거래처 단가처럼 기존 테이블의 데이터가 필요한 조회는 전부
-- SECURITY DEFINER 함수로만 열어준다(테이블 직접 조회 권한은 절대
-- 주지 않는다 — 포털 클라이언트는 이 함수들만 호출한다).

-- ── 생산 단계 분리 ──────────────────────────────────────────────

alter table public.work_orders
  add column if not exists status text not null default 'pending'
    check (status in ('pending', 'material_issued', 'completed', 'cancelled')),
  add column if not exists material_issued_at timestamptz,
  add column if not exists completed_at timestamptz;

-- 이 마이그레이션 이전에 등록된 생산지시는 전부 예전 "즉시 처리" 모델로
-- 만들어져 이미 구성품 소모+완제품 입고가 끝난 상태다 — status 기본값
-- 'pending'은 신규 행 기준이므로, 기존 행만 'completed'로 소급 지정한다.
update public.work_orders
set status = 'completed', material_issued_at = created_at, completed_at = created_at
where status = 'pending';

create table if not exists public.production_processes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  is_demo boolean not null default public.is_demo_actor(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id)
);
create index if not exists production_processes_tenant_id_idx on public.production_processes (tenant_id);
alter table public.production_processes enable row level security;

drop policy if exists "production_processes_select_authenticated" on public.production_processes;
create policy "production_processes_select_authenticated" on public.production_processes
  for select using (auth.role() = 'authenticated');
drop policy if exists "production_processes_insert_authenticated" on public.production_processes;
create policy "production_processes_insert_authenticated" on public.production_processes
  for insert with check (auth.role() = 'authenticated');
drop policy if exists "production_processes_update_authenticated" on public.production_processes;
create policy "production_processes_update_authenticated" on public.production_processes
  for update using (auth.role() = 'authenticated');
drop policy if exists "production_processes_delete_authenticated" on public.production_processes;
create policy "production_processes_delete_authenticated" on public.production_processes
  for delete using (auth.role() = 'authenticated');

drop policy if exists "production_processes_demo_isolation" on public.production_processes;
create policy "production_processes_demo_isolation" on public.production_processes
  as restrictive for all
  using (is_demo = public.is_demo_actor()) with check (is_demo = public.is_demo_actor());
drop policy if exists "production_processes_tenant_isolation" on public.production_processes;
create policy "production_processes_tenant_isolation" on public.production_processes
  as restrictive for all
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

-- 제품별 공정 순서(라우팅). 같은 공정 마스터를 여러 제품이 재사용하되,
-- 제품마다 순서/포함 여부는 다를 수 있다.
create table if not exists public.product_process_routes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  process_id uuid not null references public.production_processes (id) on delete restrict,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  is_demo boolean not null default public.is_demo_actor(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id),
  unique (product_id, process_id)
);
create index if not exists product_process_routes_product_id_idx on public.product_process_routes (product_id);
create index if not exists product_process_routes_tenant_id_idx on public.product_process_routes (tenant_id);
alter table public.product_process_routes enable row level security;

drop policy if exists "product_process_routes_select_authenticated" on public.product_process_routes;
create policy "product_process_routes_select_authenticated" on public.product_process_routes
  for select using (auth.role() = 'authenticated');
drop policy if exists "product_process_routes_insert_authenticated" on public.product_process_routes;
create policy "product_process_routes_insert_authenticated" on public.product_process_routes
  for insert with check (auth.role() = 'authenticated');
drop policy if exists "product_process_routes_update_authenticated" on public.product_process_routes;
create policy "product_process_routes_update_authenticated" on public.product_process_routes
  for update using (auth.role() = 'authenticated');
drop policy if exists "product_process_routes_delete_authenticated" on public.product_process_routes;
create policy "product_process_routes_delete_authenticated" on public.product_process_routes
  for delete using (auth.role() = 'authenticated');

drop policy if exists "product_process_routes_demo_isolation" on public.product_process_routes;
create policy "product_process_routes_demo_isolation" on public.product_process_routes
  as restrictive for all
  using (is_demo = public.is_demo_actor()) with check (is_demo = public.is_demo_actor());
drop policy if exists "product_process_routes_tenant_isolation" on public.product_process_routes;
create policy "product_process_routes_tenant_isolation" on public.product_process_routes
  as restrictive for all
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

-- 생산지시 하나가 실제로 거쳐가는 공정 단계(등록 시 product_process_routes
-- 스냅샷으로 생성 — 이후 라우팅이 바뀌어도 이미 생성된 지시의 체크리스트는
-- 그대로 유지).
create table if not exists public.work_order_process_steps (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders (id) on delete cascade,
  process_id uuid not null references public.production_processes (id) on delete restrict,
  process_name text not null,
  sort_order int not null default 0,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'done')),
  started_at timestamptz,
  completed_at timestamptz,
  note text,
  is_demo boolean not null default public.is_demo_actor(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id)
);
create index if not exists work_order_process_steps_work_order_id_idx on public.work_order_process_steps (work_order_id);
create index if not exists work_order_process_steps_tenant_id_idx on public.work_order_process_steps (tenant_id);
alter table public.work_order_process_steps enable row level security;

drop policy if exists "work_order_process_steps_select_authenticated" on public.work_order_process_steps;
create policy "work_order_process_steps_select_authenticated" on public.work_order_process_steps
  for select using (auth.role() = 'authenticated');
-- create_work_order()는 security definer가 아니라 호출자 권한 그대로
-- INSERT하므로(기존 create_work_order와 동일 원칙), 이 permissive
-- 정책이 없으면 라우팅에서 체크리스트를 만드는 insert 자체가 막힌다.
drop policy if exists "work_order_process_steps_insert_authenticated" on public.work_order_process_steps;
create policy "work_order_process_steps_insert_authenticated" on public.work_order_process_steps
  for insert with check (auth.role() = 'authenticated');
drop policy if exists "work_order_process_steps_update_authenticated" on public.work_order_process_steps;
create policy "work_order_process_steps_update_authenticated" on public.work_order_process_steps
  for update using (auth.role() = 'authenticated');
-- work_orders 삭제 시 on delete cascade로 이 행들도 같이 지워지는데,
-- delete_work_order()도 security definer가 아니라서 그 cascade 역시
-- 호출자 권한으로 실행된다 — delete 정책이 없으면 생산지시에 체크리스트가
-- 있는 경우만 삭제가 막히는 조용한 버그가 난다.
drop policy if exists "work_order_process_steps_delete_authenticated" on public.work_order_process_steps;
create policy "work_order_process_steps_delete_authenticated" on public.work_order_process_steps
  for delete using (auth.role() = 'authenticated');

drop policy if exists "work_order_process_steps_demo_isolation" on public.work_order_process_steps;
create policy "work_order_process_steps_demo_isolation" on public.work_order_process_steps
  as restrictive for all
  using (is_demo = public.is_demo_actor()) with check (is_demo = public.is_demo_actor());
drop policy if exists "work_order_process_steps_tenant_isolation" on public.work_order_process_steps;
create policy "work_order_process_steps_tenant_isolation" on public.work_order_process_steps
  as restrictive for all
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

-- create_work_order(): 이제 재고에 전혀 손대지 않는다 — 생산지시
-- "등록"만 하고(product_process_routes가 있으면 체크리스트까지 같이
-- 생성), 구성품 소모는 issue_work_order_materials(), 완제품 입고는
-- complete_work_order()로 분리했다.
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

  insert into public.work_order_process_steps (work_order_id, process_id, process_name, sort_order)
  select v_order_id, r.process_id, p.name, r.sort_order
  from public.product_process_routes r
  join public.production_processes p on p.id = r.process_id
  where r.product_id = p_product_id
  order by r.sort_order;

  return v_order_id;
end;
$$;

-- 자재투입: 대기 상태인 생산지시만 가능. BOM 기준 구성품을 출고 처리하고
-- 상태를 material_issued로 바꾼다.
-- security definer로 둔다: work_orders는 work_orders_update_owner_or_admin
-- 정책 때문에 등록자 본인/관리자만 UPDATE할 수 있는데, 자재투입·생산완료는
-- 현장 작업자가 처리하는 게 보통이라 등록자와 다른 사람이 누르는 경우가
-- 훨씬 많다. invoker 권한 그대로면 RLS가 조용히 0행을 바꾸고 함수는
-- "성공"을 반환하는 silent failure가 난다 — definer로 RLS를 우회하되
-- auth.uid() 로그인 여부만 직접 확인한다(삭제처럼 등록자/관리자로 좁힐
-- 이유가 없는, 생산지시 등록과 동급의 "로그인한 직원이면 가능"한 일상
-- 조작이기 때문).
create or replace function public.issue_work_order_materials(p_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_status text;
  v_product_id uuid;
  v_warehouse_id uuid;
  v_quantity numeric;
  v_tenant_id uuid;
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;

  select status, product_id, warehouse_id, quantity, tenant_id
    into v_status, v_product_id, v_warehouse_id, v_quantity, v_tenant_id
  from public.work_orders where id = p_id;

  if v_status is null then
    raise exception '생산지시를 찾을 수 없습니다.';
  end if;
  -- definer라 RLS가 안 걸린다 — 다른 테넌트 생산지시 id를 넣어도 그냥
  -- 조회/수정이 되어버리지 않도록 여기서 직접 막는다.
  if v_tenant_id <> public.current_tenant_id() then
    raise exception '다른 회사의 생산지시는 처리할 수 없습니다.';
  end if;
  if v_status <> 'pending' then
    raise exception '대기 상태인 생산지시만 자재투입할 수 있습니다(현재: %).', v_status;
  end if;

  insert into public.inventory_transactions (product_id, warehouse_id, type, quantity, reference, created_by)
  select component_product_id, v_warehouse_id, 'out', quantity_per_unit * v_quantity,
         'work_order:' || p_id, v_actor
  from public.bom_items
  where parent_product_id = v_product_id;

  update public.work_orders
  set status = 'material_issued', material_issued_at = now()
  where id = p_id;
end;
$$;

revoke all on function public.issue_work_order_materials(uuid) from public;
grant execute on function public.issue_work_order_materials(uuid) to authenticated;

-- 생산완료: 자재투입이 끝난 생산지시만 가능. 완제품을 입고 처리하고
-- 상태를 completed로 바꾼다. 아직 끝나지 않은 공정 체크리스트가 있어도
-- 막지는 않는다(공정 체크리스트는 진행 상황 참고용이지, 강제 게이트는
-- 아니다 — 체크리스트 자체를 아직 안 쓰는 제품도 많기 때문).
create or replace function public.complete_work_order(p_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_status text;
  v_product_id uuid;
  v_warehouse_id uuid;
  v_quantity numeric;
  v_tenant_id uuid;
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;

  select status, product_id, warehouse_id, quantity, tenant_id
    into v_status, v_product_id, v_warehouse_id, v_quantity, v_tenant_id
  from public.work_orders where id = p_id;

  if v_status is null then
    raise exception '생산지시를 찾을 수 없습니다.';
  end if;
  if v_tenant_id <> public.current_tenant_id() then
    raise exception '다른 회사의 생산지시는 처리할 수 없습니다.';
  end if;
  if v_status <> 'material_issued' then
    raise exception '자재투입이 끝난 생산지시만 생산완료 처리할 수 있습니다(현재: %).', v_status;
  end if;

  insert into public.inventory_transactions (product_id, warehouse_id, type, quantity, reference, created_by)
  values (v_product_id, v_warehouse_id, 'in', v_quantity, 'work_order:' || p_id, v_actor);

  update public.work_orders
  set status = 'completed', completed_at = now()
  where id = p_id;
end;
$$;

revoke all on function public.complete_work_order(uuid) from public;
grant execute on function public.complete_work_order(uuid) to authenticated;

-- 공정 체크리스트 한 단계 진행 상태 갱신(재고 영향 없음, 순수 진행 표시용).
create or replace function public.update_work_order_process_step(p_id uuid, p_status text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;
  if p_status not in ('pending', 'in_progress', 'done') then
    raise exception '올바르지 않은 상태 값입니다.';
  end if;

  update public.work_order_process_steps
  set status = p_status,
      started_at = case when p_status = 'in_progress' and started_at is null then now() else started_at end,
      completed_at = case when p_status = 'done' then now() else null end
  where id = p_id and tenant_id = public.current_tenant_id();

  if not found then
    raise exception '공정 단계를 찾을 수 없습니다.';
  end if;
end;
$$;

revoke all on function public.update_work_order_process_step(uuid, text) from public;
grant execute on function public.update_work_order_process_step(uuid, text) to authenticated;

-- delete_work_order(): 상태별로 되돌릴 재고 이력이 다르다 — pending이면
-- 아직 아무것도 안 움직였으니 그냥 지우면 되고, material_issued면 구성품
-- 소모만, completed면 구성품 소모+완제품 입고를 모두 반대로 되돌려야
-- 한다.
create or replace function public.delete_work_order(p_id uuid)
returns void
language plpgsql
as $$
declare
  v_actor uuid := auth.uid();
  v_owner uuid;
  v_status text;
  v_warehouse_id uuid;
  v_product_id uuid;
  v_quantity numeric;
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;

  select created_by, status, warehouse_id, product_id, quantity
    into v_owner, v_status, v_warehouse_id, v_product_id, v_quantity
  from public.work_orders where id = p_id;

  if v_owner is null then
    raise exception '생산지시를 찾을 수 없습니다.';
  end if;
  if v_owner <> v_actor and not public.is_admin() then
    raise exception '본인이 등록했거나 관리자인 경우만 삭제할 수 있습니다.';
  end if;

  if v_status in ('material_issued', 'completed') then
    insert into public.inventory_transactions (product_id, warehouse_id, type, quantity, reference, created_by)
    select component_product_id, v_warehouse_id, 'in', quantity_per_unit * v_quantity,
           'work_order_delete:' || p_id, v_actor
    from public.bom_items
    where parent_product_id = v_product_id;
  end if;

  if v_status = 'completed' then
    insert into public.inventory_transactions (product_id, warehouse_id, type, quantity, reference, created_by)
    values (v_product_id, v_warehouse_id, 'out', v_quantity, 'work_order_delete:' || p_id, v_actor);
  end if;

  delete from public.work_orders where id = p_id;
end;
$$;

-- ── 거래처 외부 포털 ────────────────────────────────────────────

create table if not exists public.customer_portal_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  username text not null,
  disabled boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  tenant_id uuid not null references public.tenants (id)
);
create index if not exists customer_portal_accounts_customer_id_idx on public.customer_portal_accounts (customer_id);
create index if not exists customer_portal_accounts_tenant_id_idx on public.customer_portal_accounts (tenant_id);
alter table public.customer_portal_accounts enable row level security;

-- 직원(내 테넌트 소속)은 자기 회사 거래처 계정을 조회/발급/비활성화할 수
-- 있다. 포털 계정 본인은 자기 행 하나만 조회할 수 있다(로그인 후 "내
-- 거래처명" 표시용) — tenant_isolation을 그대로 얹으면 tenant_members가
-- 없는 포털 계정은 자기 행조차 못 보게 되므로, 이 테이블만은 "테넌트
-- 소속 직원 또는 본인"을 하나의 RESTRICTIVE 정책으로 묶는다.
drop policy if exists "customer_portal_accounts_select_authenticated" on public.customer_portal_accounts;
create policy "customer_portal_accounts_select_authenticated" on public.customer_portal_accounts
  for select using (auth.role() = 'authenticated');
drop policy if exists "customer_portal_accounts_update_authenticated" on public.customer_portal_accounts;
create policy "customer_portal_accounts_update_authenticated" on public.customer_portal_accounts
  for update using (auth.role() = 'authenticated');

drop policy if exists "customer_portal_accounts_tenant_or_self" on public.customer_portal_accounts;
create policy "customer_portal_accounts_tenant_or_self" on public.customer_portal_accounts
  as restrictive for all
  using (tenant_id = public.current_tenant_id() or user_id = auth.uid())
  with check (tenant_id = public.current_tenant_id());

create table if not exists public.customer_orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  requested_by uuid not null references public.customer_portal_accounts (id) on delete cascade,
  status text not null default 'requested'
    check (status in ('requested', 'approved', 'rejected', 'cancelled')),
  memo text,
  reject_reason text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  work_order_id uuid references public.work_orders (id) on delete set null,
  sales_order_id uuid references public.sales_orders (id) on delete set null,
  shipping_status text not null default 'pending'
    check (shipping_status in ('pending', 'shipped', 'delivered')),
  shipped_at timestamptz,
  delivered_at timestamptz,
  doc_no bigint not null default nextval('public.work_orders_doc_no_seq'),
  created_at timestamptz not null default now(),
  is_demo boolean not null default public.is_demo_actor(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id)
);
create index if not exists customer_orders_customer_id_idx on public.customer_orders (customer_id);
create index if not exists customer_orders_tenant_id_idx on public.customer_orders (tenant_id);
alter table public.customer_orders enable row level security;

drop policy if exists "customer_orders_select_authenticated" on public.customer_orders;
create policy "customer_orders_select_authenticated" on public.customer_orders
  for select using (auth.role() = 'authenticated');
drop policy if exists "customer_orders_update_authenticated" on public.customer_orders;
create policy "customer_orders_update_authenticated" on public.customer_orders
  for update using (auth.role() = 'authenticated');

drop policy if exists "customer_orders_demo_isolation" on public.customer_orders;
create policy "customer_orders_demo_isolation" on public.customer_orders
  as restrictive for all
  using (is_demo = public.is_demo_actor()) with check (is_demo = public.is_demo_actor());
drop policy if exists "customer_orders_tenant_isolation" on public.customer_orders;
create policy "customer_orders_tenant_isolation" on public.customer_orders
  as restrictive for all
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

create table if not exists public.customer_order_items (
  id uuid primary key default gen_random_uuid(),
  customer_order_id uuid not null references public.customer_orders (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  quantity numeric not null check (quantity > 0),
  unit_price numeric(12, 2) not null default 0,
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id)
);
create index if not exists customer_order_items_order_id_idx on public.customer_order_items (customer_order_id);
create index if not exists customer_order_items_tenant_id_idx on public.customer_order_items (tenant_id);
alter table public.customer_order_items enable row level security;

drop policy if exists "customer_order_items_select_authenticated" on public.customer_order_items;
create policy "customer_order_items_select_authenticated" on public.customer_order_items
  for select using (auth.role() = 'authenticated');

drop policy if exists "customer_order_items_tenant_isolation" on public.customer_order_items;
create policy "customer_order_items_tenant_isolation" on public.customer_order_items
  as restrictive for all
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

-- handle_new_user() 분기: raw_user_meta_data에 portal_customer_id가 있으면
-- 포털 계정 전용 경로로 — tenant_members/profiles는 절대 건드리지 않고
-- customer_portal_accounts 한 줄만 만든다. 없으면 기존 직원 온보딩
-- 로직을 그대로 탄다(동작 변경 없음).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_new_tenant_name text;
  v_new_tenant_slug text;
  v_is_new_tenant boolean := false;
  v_portal_customer_id uuid;
begin
  v_portal_customer_id := nullif(new.raw_user_meta_data ->> 'portal_customer_id', '')::uuid;

  if v_portal_customer_id is not null then
    select tenant_id into v_tenant_id from public.customers where id = v_portal_customer_id;
    if v_tenant_id is null then
      raise exception '거래처를 찾을 수 없어 포털 계정을 만들 수 없습니다.';
    end if;

    insert into public.customer_portal_accounts (user_id, customer_id, username, tenant_id)
    values (
      new.id, v_portal_customer_id,
      coalesce(new.raw_user_meta_data ->> 'username', new.email),
      v_tenant_id
    );

    return new;
  end if;

  v_tenant_id := nullif(new.raw_user_meta_data ->> 'tenant_id', '')::uuid;
  v_new_tenant_name := nullif(new.raw_user_meta_data ->> 'new_tenant_name', '');
  v_new_tenant_slug := nullif(new.raw_user_meta_data ->> 'new_tenant_slug', '');

  if v_tenant_id is null and v_new_tenant_name is not null then
    insert into public.tenants (name, slug)
    values (v_new_tenant_name, v_new_tenant_slug)
    returning id into v_tenant_id;
    v_is_new_tenant := true;
  end if;

  if v_tenant_id is null then
    raise exception
      '계정 생성 시 user_metadata에 tenant_id(기존 테넌트 합류) 또는 new_tenant_name+new_tenant_slug(신규 테넌트 생성)가 반드시 필요합니다.';
  end if;

  insert into public.tenant_members (tenant_id, user_id)
  values (v_tenant_id, new.id)
  on conflict (user_id) do nothing;

  insert into public.profiles (id, full_name, email, username, tenant_id)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.email,
    new.raw_user_meta_data ->> 'username',
    v_tenant_id
  );

  if v_is_new_tenant then
    insert into public.company_profile (tenant_id, name)
    values (v_tenant_id, v_new_tenant_name);

    insert into public.document_templates (tenant_id, category, name, body)
    select v_tenant_id, d.category, d.name, d.body
    from public.default_document_templates() d;
  end if;

  return new;
end;
$$;

-- 포털 전용 조회/등록 함수 — 전부 SECURITY DEFINER로, 함수 안에서
-- auth.uid() -> customer_portal_accounts로 customer_id/tenant_id를
-- 직접 확인한 뒤 그 범위로만 쿼리한다. 포털 클라이언트에는 이 함수들
-- 외에 어떤 테이블도 직접 grant하지 않는다.

create or replace function public.portal_whoami()
returns table (customer_id uuid, customer_name text, username text)
language sql
security definer set search_path = public
stable
as $$
  select c.id, c.name, a.username
  from public.customer_portal_accounts a
  join public.customers c on c.id = a.customer_id
  where a.user_id = auth.uid() and not a.disabled;
$$;

revoke all on function public.portal_whoami() from public;
grant execute on function public.portal_whoami() to authenticated;

-- 거래처별 단가가 등록된 품목만 카탈로그로 노출한다(전 품목을 다
-- 보여주면 아직 거래 안 하는 품목까지 주문 들어올 수 있어, 이미 있는
-- "거래처별 판매단가(customer_product_prices)" 등록 여부를 그대로
-- 카탈로그 기준으로 재사용한다).
create or replace function public.portal_list_catalog()
returns table (product_id uuid, sku text, name text, spec text, unit text, unit_price numeric)
language sql
security definer set search_path = public
stable
as $$
  select p.id, p.sku, p.name, p.spec, p.unit, cpp.unit_price
  from public.customer_portal_accounts a
  join public.customer_product_prices cpp on cpp.customer_id = a.customer_id
  join public.products p on p.id = cpp.product_id and p.is_active
  where a.user_id = auth.uid() and not a.disabled
  order by p.name;
$$;

revoke all on function public.portal_list_catalog() from public;
grant execute on function public.portal_list_catalog() to authenticated;

create or replace function public.portal_create_order(p_items jsonb, p_memo text default null)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_account record;
  v_order_id uuid;
  v_item jsonb;
  v_product_id uuid;
  v_quantity numeric;
  v_unit_price numeric;
  v_item_count int := 0;
begin
  select a.id, a.customer_id, a.tenant_id into v_account
  from public.customer_portal_accounts a
  where a.user_id = auth.uid() and not a.disabled;

  if v_account is null then
    raise exception '포털 계정을 확인할 수 없습니다.';
  end if;
  if jsonb_array_length(p_items) = 0 then
    raise exception '품목을 하나 이상 담아주세요.';
  end if;

  insert into public.customer_orders (customer_id, requested_by, memo, tenant_id)
  values (v_account.customer_id, v_account.id, nullif(trim(p_memo), ''), v_account.tenant_id)
  returning id into v_order_id;

  for v_item in select jsonb_array_elements(p_items)
  loop
    v_product_id := nullif(v_item ->> 'product_id', '')::uuid;
    v_quantity := nullif(v_item ->> 'quantity', '')::numeric;

    select cpp.unit_price into v_unit_price
    from public.customer_product_prices cpp
    where cpp.customer_id = v_account.customer_id and cpp.product_id = v_product_id;

    if v_product_id is null or v_quantity is null or v_quantity <= 0 or v_unit_price is null then
      raise exception '품목 정보가 올바르지 않습니다(등록된 단가가 없는 품목은 주문할 수 없습니다).';
    end if;

    insert into public.customer_order_items (customer_order_id, product_id, quantity, unit_price, tenant_id)
    values (v_order_id, v_product_id, v_quantity, v_unit_price, v_account.tenant_id);
    v_item_count := v_item_count + 1;
  end loop;

  return v_order_id;
end;
$$;

revoke all on function public.portal_create_order(jsonb, text) from public;
grant execute on function public.portal_create_order(jsonb, text) to authenticated;

create or replace function public.portal_list_orders()
returns table (
  id uuid, doc_no bigint, status text, memo text, created_at timestamptz,
  work_order_status text, shipping_status text, item_count bigint, total_amount numeric
)
language sql
security definer set search_path = public
stable
as $$
  select
    o.id, o.doc_no, o.status, o.memo, o.created_at,
    wo.status, o.shipping_status,
    count(i.id), coalesce(sum(i.quantity * i.unit_price), 0)
  from public.customer_portal_accounts a
  join public.customer_orders o on o.customer_id = a.customer_id
  left join public.work_orders wo on wo.id = o.work_order_id
  left join public.customer_order_items i on i.customer_order_id = o.id
  where a.user_id = auth.uid() and not a.disabled
  group by o.id, o.doc_no, o.status, o.memo, o.created_at, wo.status, o.shipping_status
  order by o.created_at desc;
$$;

revoke all on function public.portal_list_orders() from public;
grant execute on function public.portal_list_orders() to authenticated;

create or replace function public.portal_get_order(p_order_id uuid)
returns table (
  id uuid, doc_no bigint, status text, memo text, reject_reason text, created_at timestamptz,
  work_order_status text, shipping_status text, shipped_at timestamptz, delivered_at timestamptz
)
language sql
security definer set search_path = public
stable
as $$
  select o.id, o.doc_no, o.status, o.memo, o.reject_reason, o.created_at,
         wo.status, o.shipping_status, o.shipped_at, o.delivered_at
  from public.customer_portal_accounts a
  join public.customer_orders o on o.customer_id = a.customer_id
  left join public.work_orders wo on wo.id = o.work_order_id
  where a.user_id = auth.uid() and not a.disabled and o.id = p_order_id;
$$;

revoke all on function public.portal_get_order(uuid) from public;
grant execute on function public.portal_get_order(uuid) to authenticated;

create or replace function public.portal_get_order_items(p_order_id uuid)
returns table (product_id uuid, name text, spec text, unit text, quantity numeric, unit_price numeric)
language sql
security definer set search_path = public
stable
as $$
  select p.id, p.name, p.spec, p.unit, i.quantity, i.unit_price
  from public.customer_portal_accounts a
  join public.customer_orders o on o.customer_id = a.customer_id
  join public.customer_order_items i on i.customer_order_id = o.id
  join public.products p on p.id = i.product_id
  where a.user_id = auth.uid() and not a.disabled and o.id = p_order_id;
$$;

revoke all on function public.portal_get_order_items(uuid) from public;
grant execute on function public.portal_get_order_items(uuid) to authenticated;

-- 공정 체크리스트까지 포털에서 조회(생산지시 상세의 "지금 어느 공정인지"
-- 참고용 — 상태 변경 권한은 없다, 읽기 전용).
create or replace function public.portal_get_order_process_steps(p_order_id uuid)
returns table (process_name text, sort_order int, status text)
language sql
security definer set search_path = public
stable
as $$
  select s.process_name, s.sort_order, s.status
  from public.customer_portal_accounts a
  join public.customer_orders o on o.customer_id = a.customer_id
  join public.work_order_process_steps s on s.work_order_id = o.work_order_id
  where a.user_id = auth.uid() and not a.disabled and o.id = p_order_id
  order by s.sort_order;
$$;

revoke all on function public.portal_get_order_process_steps(uuid) from public;
grant execute on function public.portal_get_order_process_steps(uuid) to authenticated;
