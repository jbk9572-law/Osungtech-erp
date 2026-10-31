-- C105류 "이형/삼각거래" 대응: 매입은 모품목 하나로 수불이 잡히지만, 매출은
-- 거래처/조건별로 쪼개서 서로 다른 단가로 내보내야 하는 경우가 있다(사용자
-- 요청: "1:N 매입-매출 분할 출고"). 핵심 설계:
--
--   1) 파생 SKU(모품목 링크): products.parent_product_id — 정식 품목으로
--      등록하되 모품목을 가리킨다. 재고 원장(inventory/inventory_transactions)은
--      항상 모품목 기준으로만 쌓인다 — 파생 SKU 자체는 독립 재고를 갖지 않는다.
--   2) 원가 승계(FIFO): 모품목의 매입 품목줄(purchase_order_items) 하나하나를
--      "입고 로트"로 보고, 매출(또는 자연로스) 발생 시 오래된 로트부터
--      차례로 소진하며 그 로트의 실제 매입단가를 원가로 승계한다. 소비
--      내역은 fifo_consumptions에 전부 남겨 추적 가능하게 한다.
--   3) 부모 매입 전표 수정 락: 이미 하위 매출/로스가 소진한 양 밑으로
--      매입 수량을 소급해서 줄일 수 없다(update_purchase_with_items에서 검사).
--
-- 과거 데이터(이 마이그레이션 이전의 매입/매출)는 어느 로트에서 소진됐는지
-- 추적한 적이 없어 FIFO 잔량을 정확히 복원할 수 없다 — 기존 관례(migration
-- 149 sales_order_item_cost_snapshot)와 같은 이유로, remaining_quantity는
-- 과거 매입 전량이 아직 안 쓰인 것으로 백필하고 이 마이그레이션 이후의
-- 매입/매출부터 정확히 추적된다.

-- 1) 파생 SKU(모품목 링크) ---------------------------------------------
alter table public.products
  add column if not exists parent_product_id uuid references public.products (id) on delete restrict;

create index if not exists products_parent_product_id_idx on public.products (parent_product_id);

-- 다단계(파생의 파생) 금지 — 모품목으로 지정하려는 대상이 이미 누군가의
-- 파생 품목이면 막는다. 자기 자신을 모품목으로 지정하는 것도 막는다.
create or replace function public.check_single_level_parent_product()
returns trigger
language plpgsql
as $$
begin
  if new.parent_product_id is not null then
    if new.parent_product_id = new.id then
      raise exception '품목은 스스로를 모품목으로 지정할 수 없습니다.';
    end if;
    if exists (
      select 1 from public.products
      where id = new.parent_product_id and parent_product_id is not null
    ) then
      raise exception '모품목으로 지정한 품목이 이미 다른 품목의 파생 품목입니다 — 다단계 구조는 지원하지 않습니다.';
    end if;
    if exists (select 1 from public.products where parent_product_id = new.id) then
      raise exception '이미 다른 품목의 모품목으로 쓰이고 있어 스스로를 파생 품목으로 바꿀 수 없습니다.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists check_single_level_parent_product_trg on public.products;
create trigger check_single_level_parent_product_trg
  before insert or update of parent_product_id on public.products
  for each row execute procedure public.check_single_level_parent_product();

-- 2) FIFO 레이어 잔량 -----------------------------------------------------
alter table public.purchase_order_items
  add column if not exists remaining_quantity numeric;

update public.purchase_order_items
set remaining_quantity = quantity
where remaining_quantity is null;

alter table public.purchase_order_items alter column remaining_quantity set default 0;
alter table public.purchase_order_items alter column remaining_quantity set not null;
alter table public.purchase_order_items
  add constraint purchase_order_items_remaining_quantity_check
  check (remaining_quantity >= 0 and remaining_quantity <= quantity);

create index if not exists purchase_order_items_fifo_idx
  on public.purchase_order_items (product_id, remaining_quantity)
  where remaining_quantity > 0;

-- 3) FIFO 소비 이력 --------------------------------------------------------
create table if not exists public.fifo_consumptions (
  id uuid primary key default gen_random_uuid(),
  purchase_order_item_id uuid not null references public.purchase_order_items (id) on delete restrict,
  consumed_quantity numeric not null check (consumed_quantity > 0),
  consumed_unit_cost numeric not null,
  consumed_by_type text not null check (consumed_by_type in ('sale', 'loss')),
  -- 매출 소진이면 sales_order_item_id만, 자연로스 소진이면 loss_* 컬럼만 채운다.
  sales_order_item_id uuid references public.sales_order_items (id) on delete cascade,
  loss_product_id uuid references public.products (id) on delete restrict,
  loss_warehouse_id uuid references public.warehouses (id) on delete restrict,
  note text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  is_demo boolean not null default public.is_demo_actor(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  constraint fifo_consumptions_ref_check check (
    (consumed_by_type = 'sale' and sales_order_item_id is not null and loss_product_id is null)
    or
    (consumed_by_type = 'loss' and sales_order_item_id is null and loss_product_id is not null and loss_warehouse_id is not null)
  )
);

create index if not exists fifo_consumptions_purchase_item_idx on public.fifo_consumptions (purchase_order_item_id);
create index if not exists fifo_consumptions_sales_item_idx on public.fifo_consumptions (sales_order_item_id);

alter table public.fifo_consumptions enable row level security;

create policy "fifo_consumptions_tenant_isolation" on public.fifo_consumptions
  as restrictive
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy "fifo_consumptions_demo_isolation" on public.fifo_consumptions
  as restrictive
  for all
  using (is_demo = public.is_demo_actor())
  with check (is_demo = public.is_demo_actor());

create policy "fifo_consumptions_select_authenticated" on public.fifo_consumptions
  for select using (auth.role() = 'authenticated');
create policy "fifo_consumptions_insert_authenticated" on public.fifo_consumptions
  for insert with check (auth.role() = 'authenticated');
-- update_sale_with_items/주문 삭제가 sales_order_items를 지우면 이 테이블의
-- 관련 행은 on delete cascade로 같이 지워진다(release_fifo_consumption이
-- 그 전에 먼저 remaining_quantity를 복원함) — cascade delete도 RLS 통과가
-- 필요해 delete 정책을 둔다.
create policy "fifo_consumptions_delete_authenticated" on public.fifo_consumptions
  for delete using (auth.role() = 'authenticated');

-- 4) FIFO 소진/반환 함수 ---------------------------------------------------
-- p_product_id는 반드시 모품목 id여야 한다(파생 SKU 해석은 호출부 책임) —
-- 매입 로트(purchase_order_items)를 구매일자 오름차순(FIFO)으로 잠그고
-- 필요한 수량만큼 차례로 소진하며, 소진한 만큼의 가중평균 단가를 반환한다.
-- 레이어가 모자라면(과거 미추적분/실제 레이어 부족) 남은 수량은
-- products.cost로 대체한다.
create or replace function public.consume_fifo_layers(
  p_product_id uuid,
  p_quantity numeric,
  p_consumed_by_type text,
  p_sales_order_item_id uuid default null,
  p_loss_product_id uuid default null,
  p_loss_warehouse_id uuid default null,
  p_note text default null,
  p_created_by uuid default null
)
returns numeric
language plpgsql
as $$
declare
  v_remaining numeric := p_quantity;
  v_total_cost numeric := 0;
  v_layer record;
  v_take numeric;
begin
  if p_quantity is null or p_quantity <= 0 then
    return 0;
  end if;

  for v_layer in
    select poi.id, poi.remaining_quantity, poi.unit_cost
    from public.purchase_order_items poi
    join public.purchase_orders po on po.id = poi.purchase_order_id
    where poi.product_id = p_product_id
      and poi.remaining_quantity > 0
    order by po.purchase_date asc, poi.created_at asc
    for update of poi
  loop
    exit when v_remaining <= 0;
    v_take := least(v_remaining, v_layer.remaining_quantity);

    update public.purchase_order_items
    set remaining_quantity = remaining_quantity - v_take
    where id = v_layer.id;

    insert into public.fifo_consumptions
      (purchase_order_item_id, consumed_quantity, consumed_unit_cost, consumed_by_type,
       sales_order_item_id, loss_product_id, loss_warehouse_id, note, created_by)
    values
      (v_layer.id, v_take, v_layer.unit_cost, p_consumed_by_type,
       p_sales_order_item_id, p_loss_product_id, p_loss_warehouse_id, p_note, p_created_by);

    v_total_cost := v_total_cost + v_take * v_layer.unit_cost;
    v_remaining := v_remaining - v_take;
  end loop;

  if v_remaining > 0 then
    v_total_cost := v_total_cost + v_remaining * coalesce(
      (select cost from public.products where id = p_product_id), 0
    );
  end if;

  return round(v_total_cost / p_quantity, 2);
end;
$$;

-- 매출(또는 주문) 수정/삭제로 더 이상 유효하지 않은 매출 품목줄의 FIFO
-- 소진을 되돌린다 — 소진했던 매입 로트의 remaining_quantity를 복원하고
-- 소비 이력 행을 지운다(그 sales_order_item 자체도 뒤이어 지워짐).
-- update_sale_with_items/주문 삭제 RPC가 기존 품목줄을 지우기 "직전"에
-- 반드시 먼저 호출해야 한다 — 순서가 바뀌면 remaining_quantity를
-- 복원할 단서(fifo_consumptions 행)가 cascade로 먼저 사라진다.
create or replace function public.release_fifo_consumption(p_sales_order_item_id uuid)
returns void
language plpgsql
as $$
begin
  update public.purchase_order_items poi
  set remaining_quantity = poi.remaining_quantity + fc.consumed_quantity
  from public.fifo_consumptions fc
  where fc.purchase_order_item_id = poi.id
    and fc.sales_order_item_id = p_sales_order_item_id;

  delete from public.fifo_consumptions where sales_order_item_id = p_sales_order_item_id;
end;
$$;

revoke all on function public.consume_fifo_layers(uuid, numeric, text, uuid, uuid, uuid, text, uuid) from public;
grant execute on function public.consume_fifo_layers(uuid, numeric, text, uuid, uuid, uuid, text, uuid) to authenticated;
revoke all on function public.release_fifo_consumption(uuid) from public;
grant execute on function public.release_fifo_consumption(uuid) to authenticated;

-- 5) 매입 RPC — purchase_order_items를 FIFO 레이어로 초기화 + 부모 전표
-- 수정/삭제 락 ---------------------------------------------------------
-- create_purchase_with_items: 새 매입 품목줄을 넣을 때 remaining_quantity를
-- quantity와 똑같이 채운다(이 로트 전체가 아직 안 쓰인 새 레이어).
create or replace function public.create_purchase_with_items(
  p_supplier_id uuid,
  p_warehouse_id uuid,
  p_purchase_date date,
  p_memo text,
  p_created_by uuid,
  p_items jsonb,
  p_payment_method text default null,
  p_delivery_method text default null,
  p_doc_no bigint default null,
  p_is_carryover boolean default false,
  p_tax_type text default '과세',
  p_evidence_type text default null
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

  insert into public.purchase_orders
    (supplier_id, warehouse_id, purchase_date, memo, created_by, payment_method, delivery_method, doc_no, is_carryover, tax_type, evidence_type)
  values (
    p_supplier_id, p_warehouse_id, p_purchase_date, p_memo, v_actor, p_payment_method, p_delivery_method,
    coalesce(p_doc_no, nextval('public.purchase_orders_doc_no_seq')), p_is_carryover, p_tax_type, p_evidence_type
  )
  returning id into v_order_id;

  if jsonb_array_length(p_items) > 0 then
    insert into public.purchase_order_items
      (purchase_order_id, product_id, custom_name, spec, quantity, unit_cost, remark, lot_number, remaining_quantity)
    select
      v_order_id, nullif(item->>'productId', '')::uuid, nullif(item->>'customName', ''),
      nullif(item->>'spec', ''), (item->>'quantity')::numeric, (item->>'unitCost')::numeric,
      nullif(item->>'remark', ''), nullif(item->>'lotNumber', ''), (item->>'quantity')::numeric
    from jsonb_array_elements(p_items) as item;

    insert into public.inventory_transactions (product_id, warehouse_id, type, quantity, reference, purchase_order_id, created_by)
    select
      (item->>'productId')::uuid, p_warehouse_id, 'in', (item->>'quantity')::numeric,
      'purchase_order:' || v_order_id, v_order_id, v_actor
    from jsonb_array_elements(p_items) as item
    where nullif(item->>'productId', '') is not null;
  end if;

  return v_order_id;
end;
$$;

-- update_purchase_with_items: 이미 FIFO로 소진된(remaining_quantity <
-- quantity) 품목줄이 하나라도 있으면 전표 전체 수정을 막는다 — 기존
-- 로직이 품목줄을 통째로 지우고 다시 넣는 방식이라, 이미 매출/로스가
-- 가져다 쓴 로트를 그대로 지우면 그 소비 이력(fifo_consumptions, on
-- delete restrict)이 DB 자체에서도 막히지만, 에러 메시지를 사람이 알아볼
-- 수 있게 먼저 확인해서 친절한 한국어 메시지로 막는다(요구사항 3:
-- "부모 전표 수정 제한").
create or replace function public.update_purchase_with_items(
  p_id uuid,
  p_supplier_id uuid,
  p_warehouse_id uuid,
  p_purchase_date date,
  p_memo text,
  p_updated_by uuid,
  p_items jsonb,
  p_payment_method text default null,
  p_delivery_method text default null,
  p_doc_no bigint default null,
  p_is_carryover boolean default null,
  p_tax_type text default null,
  p_evidence_type text default null
)
returns uuid
language plpgsql
as $$
declare
  v_old_warehouse_id uuid;
  v_owner uuid;
  v_old_is_carryover boolean;
  v_old_tax_type text;
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;

  select warehouse_id, created_by, is_carryover, tax_type
    into v_old_warehouse_id, v_owner, v_old_is_carryover, v_old_tax_type
  from public.purchase_orders where id = p_id;
  if v_old_warehouse_id is null then
    raise exception '매입 거래를 찾을 수 없습니다.';
  end if;
  if v_owner is distinct from v_actor and not public.is_admin() then
    raise exception '본인이 등록한 매입만 수정할 수 있습니다.';
  end if;

  if exists (
    select 1 from public.purchase_order_items
    where purchase_order_id = p_id and remaining_quantity < quantity
  ) then
    raise exception '이미 매출/로스 처리로 일부 소진된 매입 품목이 있어 이 전표는 수정할 수 없습니다 — 먼저 해당 매출을 취소하거나, 부족분은 새 매입 전표로 등록해주세요.';
  end if;

  update public.purchase_orders
  set supplier_id = p_supplier_id, warehouse_id = p_warehouse_id, purchase_date = p_purchase_date, memo = p_memo,
      payment_method = p_payment_method, delivery_method = p_delivery_method, doc_no = coalesce(p_doc_no, doc_no),
      is_carryover = coalesce(p_is_carryover, v_old_is_carryover), tax_type = coalesce(p_tax_type, v_old_tax_type),
      evidence_type = p_evidence_type
  where id = p_id;

  insert into public.inventory_transactions (product_id, warehouse_id, type, quantity, reference, created_by)
  select product_id, v_old_warehouse_id, 'adjustment', -quantity, 'purchase_order_reversal:' || p_id, v_actor
  from public.purchase_order_items where purchase_order_id = p_id and product_id is not null;

  delete from public.purchase_order_items where purchase_order_id = p_id;

  if jsonb_array_length(p_items) > 0 then
    insert into public.purchase_order_items
      (purchase_order_id, product_id, custom_name, spec, quantity, unit_cost, remark, lot_number, remaining_quantity)
    select
      p_id, nullif(item->>'productId', '')::uuid, nullif(item->>'customName', ''),
      nullif(item->>'spec', ''), (item->>'quantity')::numeric, (item->>'unitCost')::numeric,
      nullif(item->>'remark', ''), nullif(item->>'lotNumber', ''), (item->>'quantity')::numeric
    from jsonb_array_elements(p_items) as item;

    insert into public.inventory_transactions (product_id, warehouse_id, type, quantity, reference, purchase_order_id, created_by)
    select
      (item->>'productId')::uuid, p_warehouse_id, 'in', (item->>'quantity')::numeric,
      'purchase_order:' || p_id, p_id, v_actor
    from jsonb_array_elements(p_items) as item
    where nullif(item->>'productId', '') is not null;
  end if;

  return p_id;
end;
$$;

-- delete_purchase_with_items: 같은 이유로 소진된 품목이 있으면 삭제 자체를 막는다.
create or replace function public.delete_purchase_with_items(p_id uuid, p_deleted_by uuid)
returns void
language plpgsql
as $$
declare
  v_warehouse_id uuid;
  v_owner uuid;
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;

  select warehouse_id, created_by into v_warehouse_id, v_owner from public.purchase_orders where id = p_id;
  if v_warehouse_id is null then
    raise exception '매입 거래를 찾을 수 없습니다.';
  end if;
  if v_owner is distinct from v_actor and not public.is_admin() then
    raise exception '본인이 등록한 매입만 삭제할 수 있습니다.';
  end if;

  if exists (
    select 1 from public.purchase_order_items
    where purchase_order_id = p_id and remaining_quantity < quantity
  ) then
    raise exception '이미 매출/로스 처리로 일부 소진된 매입 품목이 있어 이 전표는 삭제할 수 없습니다 — 먼저 해당 매출을 취소해주세요.';
  end if;

  insert into public.inventory_transactions (product_id, warehouse_id, type, quantity, reference, created_by)
  select product_id, v_warehouse_id, 'adjustment', -quantity, 'purchase_order_reversal:' || p_id, v_actor
  from public.purchase_order_items where purchase_order_id = p_id;

  delete from public.purchase_orders where id = p_id;
end;
$$;

-- 6) 매출 RPC — 파생 SKU → 모품목 해석 + FIFO 소진/반환 ------------------
create or replace function public.create_sale_with_items(
  p_customer_id uuid,
  p_warehouse_id uuid,
  p_order_date date,
  p_memo text,
  p_created_by uuid,
  p_items jsonb,
  p_payment_method text default null,
  p_delivery_method text default null,
  p_doc_no bigint default null,
  p_is_return boolean default false,
  p_return_reason text default null,
  p_is_carryover boolean default false,
  p_tax_type text default '과세',
  p_evidence_type text default null,
  p_is_sample boolean default false
)
returns uuid
language plpgsql
as $$
declare
  v_order_id uuid;
  v_actor uuid := auth.uid();
  v_item jsonb;
  v_product_id uuid;
  v_parent_product_id uuid;
  v_quantity numeric;
  v_item_id uuid;
  v_unit_cost numeric;
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;

  insert into public.sales_orders
    (customer_id, warehouse_id, order_date, memo, created_by, payment_method, delivery_method, doc_no, is_return, return_reason, is_carryover, tax_type, evidence_type, is_sample)
  values (
    p_customer_id, p_warehouse_id, p_order_date, p_memo, v_actor, p_payment_method, p_delivery_method,
    coalesce(p_doc_no, nextval('public.sales_orders_doc_no_seq')), p_is_return,
    case when p_is_return then p_return_reason else null end,
    p_is_carryover, p_tax_type, p_evidence_type, p_is_sample
  )
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_product_id := nullif(v_item->>'productId', '')::uuid;
    v_quantity := (v_item->>'quantity')::numeric;

    insert into public.sales_order_items
      (sales_order_id, product_id, custom_name, spec, quantity, unit_price, unit_cost, remark, lot_number)
    values (
      v_order_id, v_product_id, nullif(v_item->>'customName', ''), nullif(v_item->>'spec', ''),
      v_quantity, (v_item->>'unitPrice')::numeric,
      coalesce((select p.cost from public.products p where p.id = v_product_id), 0),
      nullif(v_item->>'remark', ''), nullif(v_item->>'lotNumber', '')
    )
    returning id into v_item_id;

    if v_product_id is not null then
      -- 파생 SKU(C105-1 등)로 팔아도 실물 재고/원가는 항상 모품목 기준이다.
      v_parent_product_id := coalesce(
        (select parent_product_id from public.products where id = v_product_id), v_product_id
      );

      if p_is_return then
        -- 반품: FIFO 레이어를 되돌리지 않는다 — 어느 매출의 반품인지
        -- 연결되지 않은 자유 입력이라 정확한 역산이 불가능하다(알려진
        -- 한계, 추후 원매출 참조가 생기면 보강).
        insert into public.inventory_transactions
          (product_id, warehouse_id, type, quantity, reference, sales_order_id, created_by)
        values (v_parent_product_id, p_warehouse_id, 'in', v_quantity, 'sales_order:' || v_order_id, v_order_id, v_actor);
      else
        v_unit_cost := public.consume_fifo_layers(v_parent_product_id, v_quantity, 'sale', v_item_id, null, null, null, v_actor);
        update public.sales_order_items set unit_cost = v_unit_cost where id = v_item_id;

        insert into public.inventory_transactions
          (product_id, warehouse_id, type, quantity, reference, sales_order_id, created_by)
        values (v_parent_product_id, p_warehouse_id, 'out', v_quantity, 'sales_order:' || v_order_id, v_order_id, v_actor);
      end if;
    end if;
  end loop;

  return v_order_id;
end;
$$;

create or replace function public.update_sale_with_items(
  p_id uuid,
  p_customer_id uuid,
  p_warehouse_id uuid,
  p_order_date date,
  p_memo text,
  p_updated_by uuid,
  p_items jsonb,
  p_payment_method text default null,
  p_delivery_method text default null,
  p_doc_no bigint default null,
  p_is_return boolean default null,
  p_return_reason text default null,
  p_is_carryover boolean default null,
  p_tax_type text default null,
  p_evidence_type text default null,
  p_is_sample boolean default null
)
returns uuid
language plpgsql
as $$
declare
  v_old_warehouse_id uuid;
  v_owner uuid;
  v_old_is_return boolean;
  v_new_is_return boolean;
  v_old_is_carryover boolean;
  v_old_tax_type text;
  v_old_is_sample boolean;
  v_actor uuid := auth.uid();
  v_old_item record;
  v_item jsonb;
  v_product_id uuid;
  v_parent_product_id uuid;
  v_quantity numeric;
  v_item_id uuid;
  v_unit_cost numeric;
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;

  select warehouse_id, created_by, is_return, is_carryover, tax_type, is_sample
    into v_old_warehouse_id, v_owner, v_old_is_return, v_old_is_carryover, v_old_tax_type, v_old_is_sample
  from public.sales_orders where id = p_id;
  if v_old_warehouse_id is null then
    raise exception '매출 거래를 찾을 수 없습니다.';
  end if;
  if v_owner is distinct from v_actor and not public.is_admin() then
    raise exception '본인이 등록한 매출만 수정할 수 있습니다.';
  end if;

  v_new_is_return := coalesce(p_is_return, v_old_is_return);

  update public.sales_orders
  set customer_id = p_customer_id, warehouse_id = p_warehouse_id, order_date = p_order_date, memo = p_memo,
      payment_method = p_payment_method, delivery_method = p_delivery_method, doc_no = coalesce(p_doc_no, doc_no),
      is_return = v_new_is_return,
      return_reason = case when v_new_is_return then coalesce(p_return_reason, return_reason) else null end,
      is_carryover = coalesce(p_is_carryover, v_old_is_carryover), tax_type = coalesce(p_tax_type, v_old_tax_type),
      evidence_type = p_evidence_type, is_sample = coalesce(p_is_sample, v_old_is_sample)
  where id = p_id;

  insert into public.inventory_transactions (product_id, warehouse_id, type, quantity, reference, created_by)
  select product_id, v_old_warehouse_id, 'adjustment',
    case when v_old_is_return then -quantity else quantity end,
    'sales_order_reversal:' || p_id, v_actor
  from public.sales_order_items
  where sales_order_id = p_id and product_id is not null;

  -- FIFO로 소진했던 품목줄은(반품이 아니었다면) 지우기 전에 먼저 그
  -- 소비를 되돌려 매입 로트의 remaining_quantity를 복원한다 — 안 그러면
  -- 전표를 고칠 때마다 remaining_quantity가 계속 어긋난다.
  if not v_old_is_return then
    for v_old_item in select id from public.sales_order_items where sales_order_id = p_id loop
      perform public.release_fifo_consumption(v_old_item.id);
    end loop;
  end if;

  delete from public.sales_order_items where sales_order_id = p_id;

  if jsonb_array_length(p_items) > 0 then
    for v_item in select * from jsonb_array_elements(p_items) loop
      v_product_id := nullif(v_item->>'productId', '')::uuid;
      v_quantity := (v_item->>'quantity')::numeric;

      insert into public.sales_order_items
        (sales_order_id, product_id, custom_name, spec, quantity, unit_price, unit_cost, remark, lot_number)
      values (
        p_id, v_product_id, nullif(v_item->>'customName', ''), nullif(v_item->>'spec', ''),
        v_quantity, (v_item->>'unitPrice')::numeric,
        coalesce((select p.cost from public.products p where p.id = v_product_id), 0),
        nullif(v_item->>'remark', ''), nullif(v_item->>'lotNumber', '')
      )
      returning id into v_item_id;

      if v_product_id is not null then
        v_parent_product_id := coalesce(
          (select parent_product_id from public.products where id = v_product_id), v_product_id
        );

        if v_new_is_return then
          insert into public.inventory_transactions
            (product_id, warehouse_id, type, quantity, reference, sales_order_id, created_by)
          values (v_parent_product_id, p_warehouse_id, 'in', v_quantity, 'sales_order:' || p_id, p_id, v_actor);
        else
          v_unit_cost := public.consume_fifo_layers(v_parent_product_id, v_quantity, 'sale', v_item_id, null, null, null, v_actor);
          update public.sales_order_items set unit_cost = v_unit_cost where id = v_item_id;

          insert into public.inventory_transactions
            (product_id, warehouse_id, type, quantity, reference, sales_order_id, created_by)
          values (v_parent_product_id, p_warehouse_id, 'out', v_quantity, 'sales_order:' || p_id, p_id, v_actor);
        end if;
      end if;
    end loop;
  end if;

  return p_id;
end;
$$;

-- delete_sale_with_items: 지우기 전에 FIFO 소비를 전부 되돌린다.
create or replace function public.delete_sale_with_items(p_id uuid, p_deleted_by uuid)
returns void
language plpgsql
as $$
declare
  v_warehouse_id uuid;
  v_owner uuid;
  v_is_return boolean;
  v_actor uuid := auth.uid();
  v_item record;
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;

  select warehouse_id, created_by, is_return into v_warehouse_id, v_owner, v_is_return
  from public.sales_orders where id = p_id;
  if v_warehouse_id is null then
    raise exception '매출 거래를 찾을 수 없습니다.';
  end if;
  if v_owner is distinct from v_actor and not public.is_admin() then
    raise exception '본인이 등록한 매출만 삭제할 수 있습니다.';
  end if;

  insert into public.inventory_transactions (product_id, warehouse_id, type, quantity, reference, created_by)
  select product_id, v_warehouse_id, 'adjustment',
    case when v_is_return then -quantity else quantity end,
    'sales_order_reversal:' || p_id, v_actor
  from public.sales_order_items where sales_order_id = p_id;

  if not v_is_return then
    for v_item in select id from public.sales_order_items where sales_order_id = p_id loop
      perform public.release_fifo_consumption(v_item.id);
    end loop;
  end if;

  delete from public.sales_orders where id = p_id;
end;
$$;

-- 7) 자연로스/조정 출고 — 매출이 아니면서 재고를 줄여야 하는 경우(공정 중
-- 손실, 환산단위(UOM) 오차 등). 일반 재고조정(adjustInventory)과 달리
-- FIFO 레이어를 실제로 소진해서 매입-매출 수량 체계와 어긋나지 않게 한다.
create or replace function public.record_natural_loss(
  p_product_id uuid,
  p_warehouse_id uuid,
  p_quantity numeric,
  p_note text default null
)
returns void
language plpgsql
as $$
declare
  v_actor uuid := auth.uid();
  v_parent_product_id uuid;
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception '0보다 큰 수량을 입력해주세요.';
  end if;

  v_parent_product_id := coalesce(
    (select parent_product_id from public.products where id = p_product_id), p_product_id
  );

  perform public.consume_fifo_layers(
    v_parent_product_id, p_quantity, 'loss', null, p_product_id, p_warehouse_id, p_note, v_actor
  );

  insert into public.inventory_transactions
    (product_id, warehouse_id, type, quantity, reference, note, created_by)
  values (
    v_parent_product_id, p_warehouse_id, 'out', p_quantity, 'natural_loss',
    coalesce('자연로스: ' || p_note, '자연로스'), v_actor
  );
end;
$$;

revoke all on function public.record_natural_loss(uuid, uuid, numeric, text) from public;
grant execute on function public.record_natural_loss(uuid, uuid, numeric, text) to authenticated;
