-- 창고 간 재고 이동.
--
-- warehouses가 이미 여러 개 있을 수 있는데(재고관리 화면도 창고별로
-- 나뉘어 있음), 창고끼리 재고를 옮기는 방법이 없었다 — 매입으로 넣고
-- 매출로 빼는 식으로 우회하면 매출/매입 통계가 실제 거래가 아닌 값으로
-- 오염된다. 정식 이동 전표(stock_transfers)를 추가한다.
--
-- 재고 수량 자체는 새 컬럼이나 로직을 더하지 않고, 이미 있는 재고 계산
-- 엔진(inventory_transactions insert -> apply_inventory_transaction()
-- 트리거, migration 1/99)을 그대로 쓴다: 출발 창고에 type='out' 한 건,
-- 도착 창고에 type='in' 한 건을 같은 reference로 남기면 끝난다 —
-- inventory.quantity의 "0 미만 금지" 체크 제약이 그대로 안전장치로
-- 작동해 재고보다 많이 옮기려 하면 트랜잭션 전체가 롤백된다.

create table public.stock_transfers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  from_warehouse_id uuid not null references public.warehouses (id) on delete cascade,
  to_warehouse_id uuid not null references public.warehouses (id) on delete cascade,
  transfer_date date not null default current_date,
  memo text,
  is_demo boolean not null default public.is_demo_actor(),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint stock_transfers_different_warehouses check (from_warehouse_id <> to_warehouse_id)
);

create index stock_transfers_tenant_id_idx on public.stock_transfers (tenant_id);
create index stock_transfers_from_warehouse_id_idx on public.stock_transfers (from_warehouse_id, transfer_date desc);
create index stock_transfers_to_warehouse_id_idx on public.stock_transfers (to_warehouse_id, transfer_date desc);

alter table public.stock_transfers enable row level security;

create policy "stock_transfers_tenant_isolation" on public.stock_transfers
  as restrictive
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy "stock_transfers_demo_isolation" on public.stock_transfers
  as restrictive
  for all
  using (is_demo = public.is_demo_actor())
  with check (is_demo = public.is_demo_actor());

create policy "stock_transfers_select_authenticated" on public.stock_transfers
  for select using (auth.role() = 'authenticated');
create policy "stock_transfers_insert_authenticated" on public.stock_transfers
  for insert with check (auth.role() = 'authenticated');
create policy "stock_transfers_delete_authenticated" on public.stock_transfers
  for delete using (auth.role() = 'authenticated');

create table public.stock_transfer_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  stock_transfer_id uuid not null references public.stock_transfers (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  quantity numeric not null check (quantity > 0),
  remark text,
  is_demo boolean not null default public.is_demo_actor(),
  created_at timestamptz not null default now()
);

create index stock_transfer_items_stock_transfer_id_idx on public.stock_transfer_items (stock_transfer_id);
create index stock_transfer_items_tenant_id_idx on public.stock_transfer_items (tenant_id);

alter table public.stock_transfer_items enable row level security;

create policy "stock_transfer_items_tenant_isolation" on public.stock_transfer_items
  as restrictive
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy "stock_transfer_items_demo_isolation" on public.stock_transfer_items
  as restrictive
  for all
  using (is_demo = public.is_demo_actor())
  with check (is_demo = public.is_demo_actor());

create policy "stock_transfer_items_select_authenticated" on public.stock_transfer_items
  for select using (auth.role() = 'authenticated');
create policy "stock_transfer_items_insert_authenticated" on public.stock_transfer_items
  for insert with check (auth.role() = 'authenticated');

-- 이동 전표 + 품목 + 재고 반영(출발 out / 도착 in)을 한 트랜잭션으로
-- 처리한다. 출발 창고 재고가 모자라면 inventory.quantity의 체크
-- 제약이 막아주긴 하지만, 그 경우 에러 메시지가 "제약 조건 위반"이라는
-- 원문 그대로 나가 사용자가 이해하기 어려우므로 미리 직접 확인해서
-- 품목명을 포함한 안내 메시지로 먼저 막는다.
create or replace function public.create_stock_transfer_with_items(
  p_from_warehouse_id uuid,
  p_to_warehouse_id uuid,
  p_transfer_date date,
  p_memo text,
  p_items jsonb
)
returns uuid
language plpgsql
as $$
declare
  v_actor uuid := auth.uid();
  v_transfer_id uuid;
  v_item jsonb;
  v_product_id uuid;
  v_quantity numeric;
  v_available numeric;
  v_product_name text;
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;
  if p_from_warehouse_id = p_to_warehouse_id then
    raise exception '출발 창고와 도착 창고가 같을 수 없습니다.';
  end if;
  if jsonb_array_length(p_items) = 0 then
    raise exception '이동할 품목을 1개 이상 입력해주세요.';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_product_id := (v_item->>'productId')::uuid;
    v_quantity := (v_item->>'quantity')::numeric;

    select quantity, name into v_available, v_product_name
    from public.inventory i
    join public.products p on p.id = v_product_id
    where i.product_id = v_product_id and i.warehouse_id = p_from_warehouse_id;

    if v_available is null then
      select name into v_product_name from public.products where id = v_product_id;
      raise exception '"%"의 출발 창고 재고가 0이라 이동할 수 없습니다.', coalesce(v_product_name, '품목');
    end if;
    if v_available < v_quantity then
      raise exception '"%"의 출발 창고 재고(%)가 이동 수량(%)보다 적습니다.', v_product_name, v_available, v_quantity;
    end if;
  end loop;

  insert into public.stock_transfers (from_warehouse_id, to_warehouse_id, transfer_date, memo, created_by)
  values (p_from_warehouse_id, p_to_warehouse_id, p_transfer_date, p_memo, v_actor)
  returning id into v_transfer_id;

  insert into public.stock_transfer_items (stock_transfer_id, product_id, quantity, remark)
  select
    v_transfer_id,
    (item->>'productId')::uuid,
    (item->>'quantity')::numeric,
    nullif(item->>'remark', '')
  from jsonb_array_elements(p_items) as item;

  insert into public.inventory_transactions (product_id, warehouse_id, type, quantity, reference, note, created_by)
  select
    (item->>'productId')::uuid,
    p_from_warehouse_id,
    'out',
    (item->>'quantity')::numeric,
    'stock_transfer:' || v_transfer_id,
    '창고 이동(출발)',
    v_actor
  from jsonb_array_elements(p_items) as item;

  insert into public.inventory_transactions (product_id, warehouse_id, type, quantity, reference, note, created_by)
  select
    (item->>'productId')::uuid,
    p_to_warehouse_id,
    'in',
    (item->>'quantity')::numeric,
    'stock_transfer:' || v_transfer_id,
    '창고 이동(도착)',
    v_actor
  from jsonb_array_elements(p_items) as item;

  return v_transfer_id;
end;
$$;

-- 이동 전표 삭제 — delete_sale_with_items와 동일한 패턴(재고를 되돌리는
-- 반대 방향 adjustment 트랜잭션을 먼저 남기고 전표를 지운다). 도착
-- 창고에 옮겨온 재고를 이미 다른 곳에 다시 써버렸으면(예: 도착 창고에서
-- 그대로 출고) 도착 창고 재고가 마이너스로 내려가 실패할 수 있는데,
-- inventory.quantity의 체크 제약이 막아주는 게 맞는 동작이다 — 실제로
-- 없는 재고를 있었던 것처럼 되돌릴 수는 없다.
create or replace function public.delete_stock_transfer(p_id uuid)
returns void
language plpgsql
as $$
declare
  v_actor uuid := auth.uid();
  v_owner uuid;
  v_from_warehouse_id uuid;
  v_to_warehouse_id uuid;
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;

  select created_by, from_warehouse_id, to_warehouse_id
    into v_owner, v_from_warehouse_id, v_to_warehouse_id
  from public.stock_transfers where id = p_id;

  if v_from_warehouse_id is null then
    raise exception '이동 전표를 찾을 수 없습니다.';
  end if;
  if v_owner is distinct from v_actor and not public.is_admin() then
    raise exception '본인이 등록한 이동 전표만 삭제할 수 있습니다.';
  end if;

  insert into public.inventory_transactions (product_id, warehouse_id, type, quantity, reference, note, created_by)
  select product_id, v_from_warehouse_id, 'adjustment', quantity, 'stock_transfer_reversal:' || p_id, '창고 이동 취소(복원)', v_actor
  from public.stock_transfer_items where stock_transfer_id = p_id;

  insert into public.inventory_transactions (product_id, warehouse_id, type, quantity, reference, note, created_by)
  select product_id, v_to_warehouse_id, 'adjustment', -quantity, 'stock_transfer_reversal:' || p_id, '창고 이동 취소(회수)', v_actor
  from public.stock_transfer_items where stock_transfer_id = p_id;

  delete from public.stock_transfers where id = p_id;
end;
$$;
