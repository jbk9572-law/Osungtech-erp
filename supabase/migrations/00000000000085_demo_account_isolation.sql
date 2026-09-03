-- "테스트(데모) 계정" 격리.
--
-- 외부에 시연용으로 넘겨줄 test 계정이 진짜 거래처/매출/재고 등 중요한
-- 데이터를 절대 볼 수 없게 만들어달라는 요청 — 다만 그냥 "읽기 전용"이
-- 아니라, 가짜 데이터 안에서는 직접 등록/수정도 자유롭게 해볼 수 있어야
-- 한다.
--
-- 화면(서버 액션)마다 "이 계정이면 가짜 데이터를 보여줘" 식으로 나눠서
-- 처리하면, 화면 하나라도 빠뜨리는 순간 그 화면에서 진짜 데이터가 그대로
-- 새는 사고가 난다. 그래서 애플리케이션 코드는 전혀 건드리지 않고,
-- Postgres RLS의 "RESTRICTIVE 정책"으로 DB 레벨에서 원천 차단한다:
--
--   - 기존에 이미 있는 정책(permissive)은 하나도 손대지 않는다. 지금 잘
--     동작하는 진짜 업무 기능이 실수로 망가질 여지가 없다.
--   - 테이블마다 "이 행의 is_demo가 지금 로그인한 계정의 데모 여부와
--     같아야만 보인다"는 RESTRICTIVE 정책을 하나씩 얹는다. RESTRICTIVE는
--     기존 permissive 정책과 AND로 묶여서 접근 범위를 좁히기만 하므로,
--     관리자 권한(is_admin())으로 우회하던 기존 정책이 있어도 이 필터를
--     피해갈 수 없다 — "데모 관리자" 계정을 만들어도 실제 데이터는 절대
--     못 본다.
--   - is_demo 컬럼은 기본값을 is_demo_actor()로 둬서, RPC/서버 액션이
--     새 행을 넣을 때 아무것도 안 바꿔도 "지금 로그인한 계정이 데모
--     계정인가"에 따라 자동으로 채워진다 — 매출/매입 등록 RPC 등 기존
--     코드를 단 한 줄도 고칠 필요가 없다(이 RPC들은 security definer가
--     아니라서 auth.uid()가 실제 호출자 그대로 유지된다).
--
-- security definer 트리거 2개(재고 반영, 감사로그 기록)는 기본값 방식이
-- 아니라 명시적으로 is_demo를 넘겨준다 — 아래 각주 참고.
--
-- 실제 데모 데이터는 이 마이그레이션에서 미리 심어두지 않는다. test
-- 계정을 만든 뒤 그 계정으로 로그인해서 가짜 거래처/품목/매출을 직접
-- 입력하면, 이 격리 장치 덕분에 그 즉시 데모 전용으로 자동 분리된다.

-- 0) is_demo_actor()가 곧바로 profiles.is_demo를 참조하므로, 함수보다
--    컬럼을 먼저 만들어둔다(반대 순서면 check_function_bodies 기본값 때문에
--    "존재하지 않는 컬럼" 에러로 함수 생성 자체가 실패한다). profiles는
--    맨 아래 5)에서 다시 다루면서 정책까지 마저 건다 — 여기서는 컬럼만.
alter table public.profiles add column if not exists is_demo boolean not null default false;

-- 1) 데모 계정 여부 판정 함수. is_admin()과 완전히 같은 패턴
--    (security definer + profiles 조회)이라 RLS 순환 참조 없이 안전하다.
create or replace function public.is_demo_actor()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select is_demo from public.profiles where id = auth.uid()),
    false
  );
$$;

revoke all on function public.is_demo_actor() from public;
grant execute on function public.is_demo_actor() to authenticated;

-- 2) 업무 데이터 테이블 26개에 일괄로 is_demo 컬럼 + RESTRICTIVE 정책을
--    건다. 전부 같은 규칙(is_demo = is_demo_actor())이라 테이블마다 손으로
--    반복해 적다가 하나 빠뜨리는 실수를 막기 위해 반복문으로 처리한다.
do $$
declare
  tbl text;
  tables text[] := array[
    'categories', 'customers', 'suppliers', 'products',
    'inventory_transactions', 'sales_orders', 'sales_order_items',
    'purchase_orders', 'purchase_order_items', 'todos', 'announcements',
    'announcement_reads', 'paper_calculations', 'paper_stock_overrides',
    'payment_requests', 'payment_request_line_items', 'payment_request_receipts',
    'customer_payments', 'supplier_payments', 'price_change_schedules',
    'purchase_price_change_schedules', 'customer_product_prices',
    'supplier_product_prices', 'product_package_qty_history',
    'calendar_notes', 'messenger_messages'
  ];
begin
  foreach tbl in array tables loop
    execute format(
      'alter table public.%I add column if not exists is_demo boolean not null default public.is_demo_actor()',
      tbl
    );
    execute format('drop policy if exists %I on public.%I', tbl || '_demo_isolation', tbl);
    execute format(
      'create policy %I on public.%I as restrictive for all using (is_demo = public.is_demo_actor()) with check (is_demo = public.is_demo_actor())',
      tbl || '_demo_isolation', tbl
    );
  end loop;
end $$;

-- 3) inventory — apply_inventory_transaction() 트리거(security definer)를
--    통해서만 채워진다. 트리거 안에서 곧바로 명시적으로 is_demo를 넘겨줄
--    것이므로 컬럼 기본값 자체는 의미가 없지만, 다른 테이블과 일관되게
--    false로 둔다.
alter table public.inventory add column if not exists is_demo boolean not null default false;
drop policy if exists "inventory_demo_isolation" on public.inventory;
create policy "inventory_demo_isolation" on public.inventory
  as restrictive
  for all
  using (is_demo = public.is_demo_actor())
  with check (is_demo = public.is_demo_actor());

-- apply_inventory_transaction() 재정의 — 00000000000075의 최신 버전(수량을
-- numeric으로 다루는 버전) 그대로에 is_demo 전파만 추가한다. product_id가
-- 실제/데모 품목마다 서로 다른 행이라 원래도 실제-데모 재고가 섞일 일은
-- 없지만, 이중 안전장치로 WHERE에도 is_demo를 같이 맞춘다.
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
    and is_demo = new.is_demo;

  get diagnostics updated_rows = row_count;

  if updated_rows = 0 then
    insert into public.inventory (product_id, warehouse_id, quantity, is_demo, updated_at)
    values (new.product_id, new.warehouse_id, delta, new.is_demo, now());
  end if;

  return new;
end;
$$;

-- 4) audit_logs — record_audit_log() 트리거(security definer)로만
--    채워진다. 감시 대상 테이블(sales_orders 등)에 is_demo가 막 생겼으니,
--    그 값을 그대로 옮겨 담는다.
alter table public.audit_logs add column if not exists is_demo boolean not null default false;
drop policy if exists "audit_logs_demo_isolation" on public.audit_logs;
create policy "audit_logs_demo_isolation" on public.audit_logs
  as restrictive
  for all
  using (is_demo = public.is_demo_actor())
  with check (is_demo = public.is_demo_actor());

create or replace function public.record_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    insert into public.audit_logs (table_name, record_id, action, actor, new_data, is_demo)
    values (
      tg_table_name, new.id, 'insert', auth.uid(), to_jsonb(new),
      coalesce((to_jsonb(new) ->> 'is_demo')::boolean, false)
    );
    return new;
  elsif (tg_op = 'UPDATE') then
    insert into public.audit_logs (table_name, record_id, action, actor, old_data, new_data, is_demo)
    values (
      tg_table_name, new.id, 'update', auth.uid(), to_jsonb(old), to_jsonb(new),
      coalesce((to_jsonb(new) ->> 'is_demo')::boolean, false)
    );
    return new;
  elsif (tg_op = 'DELETE') then
    insert into public.audit_logs (table_name, record_id, action, actor, old_data, is_demo)
    values (
      tg_table_name, old.id, 'delete', auth.uid(), to_jsonb(old),
      coalesce((to_jsonb(old) ->> 'is_demo')::boolean, false)
    );
    return old;
  end if;
  return null;
end;
$$;

-- 5) profiles — 컬럼은 0)에서 이미 만들어뒀다. 다른 테이블과 다르게
--    "실제 관리자"는 test 계정을 만들고/수정하고/지우려면 사용자 목록에서
--    그 계정이 보여야 한다. 그래서 나머지 테이블처럼 완전히 대칭으로
--    막지 않고, "실제 관리자는 전부 보되, 데모 계정(관리자 역할이어도)은
--    데모 프로필만 본다"로 비대칭하게 만든다 — 데모 계정을 관리자
--    권한으로 만들어서 데모용 사용자 관리 화면까지 시연해도, 실제 직원
--    명단은 여전히 안 보인다.
drop policy if exists "profiles_demo_isolation" on public.profiles;
create policy "profiles_demo_isolation" on public.profiles
  as restrictive
  for all
  using (
    (not public.is_demo_actor() and public.is_admin())
    or is_demo = public.is_demo_actor()
  )
  with check (
    (not public.is_demo_actor() and public.is_admin())
    or is_demo = public.is_demo_actor()
  );
