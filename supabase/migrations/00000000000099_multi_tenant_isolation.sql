-- 멀티테넌트 전환 2단계: 실제 업무 테이블에 tenant_id를 얹는다.
--
-- migration 98에서 만든 tenants/tenant_members/current_tenant_id()를
-- 바탕으로, migration 85(데모 계정 격리)와 완전히 같은 방식(RESTRICTIVE
-- 정책 반복문)으로 각 테이블에 "이 테넌트 소속이어야만 보인다"는 필터를
-- 얹는다. 기존 permissive 정책은 하나도 건드리지 않는다 — RESTRICTIVE
-- 정책은 AND로만 겹쳐지므로 기존 업무 로직/권한 체계는 그대로다.
--
-- 컬럼 기본값을 곧바로 current_tenant_id()로 걸어도, 이 마이그레이션을
-- 실행하는 시점(로그인 세션 없음)에는 auth.uid()가 없어 모든 기존 행이
-- null로 채워진다 — 그래서 반드시 명시적으로 "오성테크 테넌트 id"로
-- 백필한 다음에 NOT NULL을 건다. 이후 실제 서비스에서 로그인한 사용자가
-- 새 행을 넣을 때는 auth.uid() 기준 current_tenant_id()가 정상적으로
-- 채워진다(생성/수정 RPC들이 security definer가 아니라서 호출자
-- 신원이 그대로 유지된다는 점은 migration 85 때와 동일).

do $$
declare
  tbl text;
  v_tenant_id uuid;
  -- migration 85의 데모 격리 대상 26개 테이블 + 이후 추가된 위치/이력/
  -- 그리드설정 테이블들 + warehouses(아래에서 is_demo 결함도 같이 고침).
  -- inventory/audit_logs/profiles/company_profile은 트리거 전파나 특수
  -- 유니크 제약이 있어 이 반복문 밖에서 따로 처리한다.
  tables text[] := array[
    'categories', 'customers', 'suppliers', 'products',
    'inventory_transactions', 'sales_orders', 'sales_order_items',
    'purchase_orders', 'purchase_order_items', 'todos', 'announcements',
    'announcement_reads', 'paper_calculations', 'paper_stock_overrides',
    'payment_requests', 'payment_request_line_items', 'payment_request_receipts',
    'customer_payments', 'supplier_payments', 'price_change_schedules',
    'purchase_price_change_schedules', 'customer_product_prices',
    'supplier_product_prices', 'product_package_qty_history',
    'calendar_notes', 'messenger_messages',
    'locations', 'inventory_locations', 'location_stock_history',
    'ui_grid_column_widths', 'order_item_location_stock', 'warehouses'
  ];
begin
  select id into v_tenant_id from public.tenants where name = '오성테크' limit 1;

  foreach tbl in array tables loop
    execute format(
      'alter table public.%I add column if not exists tenant_id uuid references public.tenants (id) default public.current_tenant_id()',
      tbl
    );
    execute format('update public.%I set tenant_id = $1 where tenant_id is null', tbl) using v_tenant_id;
    execute format('alter table public.%I alter column tenant_id set not null', tbl);
    execute format('create index if not exists %I on public.%I (tenant_id)', tbl || '_tenant_id_idx', tbl);
    execute format('drop policy if exists %I on public.%I', tbl || '_tenant_isolation', tbl);
    execute format(
      'create policy %I on public.%I as restrictive for all using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id())',
      tbl || '_tenant_isolation', tbl
    );
  end loop;
end $$;

-- warehouses: 위 반복문으로 tenant_id는 이미 처리됐지만, 애초에 데모 계정
-- 격리(is_demo)에서도 통째로 빠져 있던 기존 결함이 있었다(migration 85가
-- 26개 표준 테이블만 돌렸는데 warehouses는 그 목록에 없었다) — 데모
-- 계정이 실제 창고 목록을 그대로 보고/수정할 수 있었다는 뜻이라, 같은
-- RESTRICTIVE 방식으로 지금 같이 고친다(버그 패턴 스캔 규칙: 같은
-- 종류의 결함을 발견하면 그 자리에서 같이 고친다).
alter table public.warehouses add column if not exists is_demo boolean not null default public.is_demo_actor();
drop policy if exists "warehouses_demo_isolation" on public.warehouses;
create policy "warehouses_demo_isolation" on public.warehouses
  as restrictive
  for all
  using (is_demo = public.is_demo_actor())
  with check (is_demo = public.is_demo_actor());

-- inventory: apply_inventory_transaction() 트리거(security definer)를
-- 통해서만 채워지므로, is_demo와 마찬가지로 tenant_id도 신규 행을 넣을
-- 때 발생시킨 inventory_transactions 쪽 값을 그대로 명시적으로 넘겨줘야
-- 한다(컬럼 기본값에만 의존하면, 나중에 서비스 롤로 일괄 처리하는
-- 배치 스크립트가 생겼을 때 auth.uid()가 없어 값이 비게 된다).
alter table public.inventory add column if not exists tenant_id uuid references public.tenants (id) default public.current_tenant_id();
update public.inventory inv set tenant_id = t.id
  from public.tenants t where t.name = '오성테크' and inv.tenant_id is null;
alter table public.inventory alter column tenant_id set not null;
create index if not exists inventory_tenant_id_idx on public.inventory (tenant_id);
drop policy if exists "inventory_tenant_isolation" on public.inventory;
create policy "inventory_tenant_isolation" on public.inventory
  as restrictive
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create or replace function public.apply_inventory_transaction()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  delta numeric;
  updated_rows integer;
begin
  delta := case
    when new.type = 'out' then -abs(new.quantity)
    else new.quantity
  end;

  update public.inventory
  set quantity = quantity + delta, updated_at = now()
  where product_id = new.product_id
    and warehouse_id = new.warehouse_id
    and is_demo = new.is_demo
    and tenant_id = new.tenant_id;

  get diagnostics updated_rows = row_count;

  if updated_rows = 0 then
    insert into public.inventory (product_id, warehouse_id, quantity, is_demo, tenant_id, updated_at)
    values (new.product_id, new.warehouse_id, delta, new.is_demo, new.tenant_id, now());
  end if;

  return new;
end;
$$;

-- audit_logs: record_audit_log() 트리거(security definer)를 통해서만
-- 채워진다. 감시 대상 테이블에 이미 tenant_id가 생겼으니 그 값을 그대로
-- 옮겨 담는다(is_demo를 옮겨 담던 방식과 동일).
alter table public.audit_logs add column if not exists tenant_id uuid references public.tenants (id) default public.current_tenant_id();
update public.audit_logs al set tenant_id = t.id
  from public.tenants t where t.name = '오성테크' and al.tenant_id is null;
alter table public.audit_logs alter column tenant_id set not null;
create index if not exists audit_logs_tenant_id_idx on public.audit_logs (tenant_id);
drop policy if exists "audit_logs_tenant_isolation" on public.audit_logs;
create policy "audit_logs_tenant_isolation" on public.audit_logs
  as restrictive
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create or replace function public.record_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    insert into public.audit_logs (table_name, record_id, action, actor, new_data, is_demo, tenant_id)
    values (
      tg_table_name, new.id, 'insert', auth.uid(), to_jsonb(new),
      coalesce((to_jsonb(new) ->> 'is_demo')::boolean, false),
      nullif(to_jsonb(new) ->> 'tenant_id', '')::uuid
    );
    return new;
  elsif (tg_op = 'UPDATE') then
    insert into public.audit_logs (table_name, record_id, action, actor, old_data, new_data, is_demo, tenant_id)
    values (
      tg_table_name, new.id, 'update', auth.uid(), to_jsonb(old), to_jsonb(new),
      coalesce((to_jsonb(new) ->> 'is_demo')::boolean, false),
      nullif(to_jsonb(new) ->> 'tenant_id', '')::uuid
    );
    return new;
  elsif (tg_op = 'DELETE') then
    insert into public.audit_logs (table_name, record_id, action, actor, old_data, is_demo, tenant_id)
    values (
      tg_table_name, old.id, 'delete', auth.uid(), to_jsonb(old),
      coalesce((to_jsonb(old) ->> 'is_demo')::boolean, false),
      nullif(to_jsonb(old) ->> 'tenant_id', '')::uuid
    );
    return old;
  end if;
  return null;
end;
$$;

-- profiles: 다른 테넌트 회사 직원 명단이 서로한테 안 보여야 한다. 기존
-- profiles_demo_isolation(실제 관리자는 전체, 데모는 데모끼리)은 그대로
-- 두고, tenant_id RESTRICTIVE를 한 겹 더 얹는다 — 두 RESTRICTIVE 정책은
-- AND로 겹쳐지므로 "같은 테넌트 + (실제 관리자 전체 or 데모끼리)"가
-- 최종 조건이 된다.
alter table public.profiles add column if not exists tenant_id uuid references public.tenants (id) default public.current_tenant_id();
update public.profiles p set tenant_id = t.id
  from public.tenants t where t.name = '오성테크' and p.tenant_id is null;
alter table public.profiles alter column tenant_id set not null;
create index if not exists profiles_tenant_id_idx on public.profiles (tenant_id);
drop policy if exists "profiles_tenant_isolation" on public.profiles;
create policy "profiles_tenant_isolation" on public.profiles
  as restrictive
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- 이제 profiles.tenant_id 컬럼이 생겼으니, 신규 가입 트리거도 여기서
-- 마저 갱신한다(migration 98에서 미뤄뒀던 부분) — tenant_members에 먼저
-- 넣어야 그다음 profiles insert가 참조할 tenant_id 값이 있다.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_tenant_id uuid;
begin
  select id into v_tenant_id from public.tenants where name = '오성테크' limit 1;

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
  return new;
end;
$$;

-- company_profile: migration 86에서 "실제 행 1개 + 데모 행 1개"만 허용
--하도록 unique(is_demo) 제약을 걸어뒀는데, 테넌트가 여러 개가 되면
-- 테넌트마다 자기 회사정보 행이 하나씩 있어야 하므로 unique(tenant_id,
-- is_demo)로 넓혀야 한다(제거가 아니라 확장 — 지금은 테넌트가 하나뿐이라
-- 동작은 완전히 똑같고, 나중에 테넌트 #2가 생겨도 그 순간부터 자연히
-- 지원된다).
alter table public.company_profile add column if not exists tenant_id uuid references public.tenants (id) default public.current_tenant_id();
update public.company_profile cp set tenant_id = t.id
  from public.tenants t where t.name = '오성테크' and cp.tenant_id is null;
alter table public.company_profile alter column tenant_id set not null;

drop index if exists public.company_profile_one_per_tenant;
create unique index if not exists company_profile_one_per_tenant
  on public.company_profile (tenant_id, is_demo);

drop policy if exists "company_profile_tenant_isolation" on public.company_profile;
create policy "company_profile_tenant_isolation" on public.company_profile
  as restrictive
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());
