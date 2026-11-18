-- 269: 재고 이력·위치·창고이동을 직원이 REST 로 직접 고치지 못하게 한다(같은 회사 직원이 FIFO 소진 이력, 위치별 재고, 이동 전표를 임의로 지우거나 만드는 것 차단).
-- 이 테이블들은 아래 함수들(invoker)만 쓰므로, 각 함수가 시작할 때 "내부 쓰기" 표시(app.internal_write)를 켜고(트랜잭션 안에서만 유효),
-- 표시 없이 직원(authenticated)이 직접 쓰면 트리거가 거절한다. 관리자·샌드박스·정의자(definer) 트리거/함수는 통과.
-- (Supabase 는 ALTER FUNCTION ... SET app.* 를 허용하지 않아 set_config 를 함수 본문에서 호출한다.)
create or replace function public.guard_internal_stock_write()
returns trigger
language plpgsql
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return coalesce(new, old);
  end if;
  if current_setting('app.internal_write', true) = 'on' or public.is_admin() or public.is_sandbox_tenant() then
    return coalesce(new, old);
  end if;
  raise exception '재고 이력·위치·창고이동은 직접 고칠 수 없습니다. 해당 업무 화면(입출고·이동·실사)을 이용해주세요.';
end;
$$;

drop trigger if exists fifo_consumptions_guard_write on public.fifo_consumptions;
create trigger fifo_consumptions_guard_write before insert or update or delete on public.fifo_consumptions
  for each row execute function public.guard_internal_stock_write();
drop trigger if exists inventory_locations_guard_write on public.inventory_locations;
create trigger inventory_locations_guard_write before insert or update or delete on public.inventory_locations
  for each row execute function public.guard_internal_stock_write();
drop trigger if exists stock_transfers_guard_write on public.stock_transfers;
create trigger stock_transfers_guard_write before insert or update or delete on public.stock_transfers
  for each row execute function public.guard_internal_stock_write();
drop trigger if exists stock_transfer_items_guard_write on public.stock_transfer_items;
create trigger stock_transfer_items_guard_write before insert or update or delete on public.stock_transfer_items
  for each row execute function public.guard_internal_stock_write();

-- apply_location_stock_delta: 시작할 때 내부 쓰기 표시를 켠다.
create or replace function public.apply_location_stock_delta(
  p_product_id uuid,
  p_location_id uuid,
  p_delta numeric
)
returns void
language plpgsql
as $$
begin
  perform set_config('app.internal_write', 'on', true);
  if p_delta = 0 then
    return;
  end if;

  perform set_config('app.stock_reason', case when p_delta > 0 then 'in' else 'out' end, true);

  update public.inventory_locations
  set quantity = quantity + p_delta, updated_at = now()
  where product_id = p_product_id and location_id = p_location_id;

  if not found then
    insert into public.inventory_locations (product_id, location_id, quantity, updated_at)
    values (p_product_id, p_location_id, p_delta, now());
  end if;
end;
$$;

-- consume_fifo_layers: 시작할 때 내부 쓰기 표시를 켠다.
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
  perform set_config('app.internal_write', 'on', true);
  if p_quantity is null or p_quantity <= 0 then
    return 0;
  end if;

  -- 오래된 입고분부터 차감한다(선입선출).
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

-- release_fifo_consumption: 시작할 때 내부 쓰기 표시를 켠다.
create or replace function public.release_fifo_consumption(p_sales_order_item_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('app.internal_write', 'on', true);
  update public.purchase_order_items poi
  set remaining_quantity = poi.remaining_quantity + fc.consumed_quantity
  from public.fifo_consumptions fc
  where fc.purchase_order_item_id = poi.id
    and fc.sales_order_item_id = p_sales_order_item_id;

  delete from public.fifo_consumptions where sales_order_item_id = p_sales_order_item_id;
end;
$$;

-- backfill_fifo_consumption_for_purchase: 시작할 때 내부 쓰기 표시를 켠다.
create or replace function public.backfill_fifo_consumption_for_purchase(
  p_purchase_order_item_id uuid
)
returns void
language plpgsql
as $$
declare
  v_product_id uuid;
  v_unit_cost numeric;
  v_remaining numeric;
  v_tenant_id uuid;
  v_purchase_date date;
  v_item record;
  v_take numeric;
  v_new_total_cost numeric;
  v_new_total_qty numeric;
begin
  perform set_config('app.internal_write', 'on', true);
  select poi.product_id, poi.unit_cost, poi.remaining_quantity, poi.tenant_id, po.purchase_date
    into v_product_id, v_unit_cost, v_remaining, v_tenant_id, v_purchase_date
  from public.purchase_order_items poi
  join public.purchase_orders po on po.id = poi.purchase_order_id
  where poi.id = p_purchase_order_item_id
  for update of poi;

  if v_product_id is null or v_remaining is null or v_remaining <= 0 then
    return;
  end if;

  for v_item in
    select
      soi.id as sales_order_item_id,
      soi.quantity - coalesce(
        (select sum(fc.consumed_quantity) from public.fifo_consumptions fc
         where fc.sales_order_item_id = soi.id), 0
      ) as deficit
    from public.sales_order_items soi
    join public.sales_orders so on so.id = soi.sales_order_id
    where coalesce(
      (select p.parent_product_id from public.products p where p.id = soi.product_id),
      soi.product_id
    ) = v_product_id
      and not so.is_return
      -- 매입일 앞뒤 14일 이내 매출만 연결한다(드롭십은 며칠 안에 끝난다). 예전엔
      -- 과거에 재고가 모자라 연결 못 한 모든 오래된 매출이 새 매입을 가로챘다 —
      -- 그러면 그 매입이 엉뚱한 옛 매출 때문에 삭제/수정이 막히고, 옛 매출의
      -- 원가가 새 매입 단가로 바뀐다(샌드박스 실데이터에서 재현).
      and so.order_date between v_purchase_date - 14 and v_purchase_date + 14
    order by so.order_date asc, soi.created_at asc
    for update of soi
  loop
    exit when v_remaining <= 0;
    if v_item.deficit is null or v_item.deficit <= 0 then
      continue;
    end if;

    v_take := least(v_remaining, v_item.deficit);

    update public.purchase_order_items
    set remaining_quantity = remaining_quantity - v_take
    where id = p_purchase_order_item_id;

    insert into public.fifo_consumptions
      (purchase_order_item_id, consumed_quantity, consumed_unit_cost, consumed_by_type, sales_order_item_id, tenant_id)
    values
      (p_purchase_order_item_id, v_take, v_unit_cost, 'sale', v_item.sales_order_item_id, v_tenant_id);

    select
      coalesce(sum(fc.consumed_quantity * fc.consumed_unit_cost), 0),
      coalesce(sum(fc.consumed_quantity), 0)
    into v_new_total_cost, v_new_total_qty
    from public.fifo_consumptions fc
    where fc.sales_order_item_id = v_item.sales_order_item_id;

    update public.sales_order_items soi2
    set unit_cost = round(
      (
        v_new_total_cost +
        greatest(soi2.quantity - v_new_total_qty, 0) *
          coalesce((select p.cost from public.products p where p.id = v_product_id), 0)
      ) / soi2.quantity,
      2
    )
    where soi2.id = v_item.sales_order_item_id;

    v_remaining := v_remaining - v_take;
  end loop;
end;
$$;

-- create_purchase_and_sale_with_items: 시작할 때 내부 쓰기 표시를 켠다.
create or replace function public.create_purchase_and_sale_with_items(
  p_supplier_id uuid,
  p_customer_id uuid,
  p_warehouse_id uuid,
  p_purchase_date date,
  p_sale_date date,
  p_purchase_memo text,
  p_sale_memo text,
  p_created_by uuid,
  p_purchase_items jsonb,
  p_sale_items jsonb,
  p_payment_method text default null,
  p_delivery_method text default null,
  p_purchase_doc_no bigint default null,
  p_sale_doc_no bigint default null,
  p_sale_delivery_method text default null,
  p_tax_type text default '과세',
  p_evidence_type text default null
)
returns table (purchase_order_id uuid, sale_order_id uuid)
language plpgsql
as $$
declare
  v_purchase_id uuid;
  v_sale_id uuid;
  v_over_product_id uuid;
  v_actor uuid := auth.uid();
  v_sale_item jsonb;
  v_sale_item_id uuid;
  v_need numeric;
  v_take numeric;
  v_lot record;
  v_cost_total numeric;
  v_cost_qty numeric;
begin
  perform set_config('app.internal_write', 'on', true);
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;

  with sale_totals as (
    select (item->>'productId')::uuid as product_id,
           sum((item->>'quantity')::numeric) as qty
    from jsonb_array_elements(p_sale_items) as item
    group by (item->>'productId')::uuid
  ),
  purchase_totals as (
    select (item->>'productId')::uuid as product_id,
           sum((item->>'quantity')::numeric) as qty
    from jsonb_array_elements(p_purchase_items) as item
    group by (item->>'productId')::uuid
  )
  select s.product_id into v_over_product_id
  from sale_totals s
  left join purchase_totals p on p.product_id = s.product_id
  where s.qty > coalesce(p.qty, 0)
  limit 1;

  if v_over_product_id is not null then
    raise exception '출고 수량이 매입 수량보다 많은 품목이 있습니다 (product_id: %)', v_over_product_id;
  end if;

  insert into public.purchase_orders
    (supplier_id, warehouse_id, purchase_date, memo, created_by, payment_method, delivery_method, doc_no, tax_type, evidence_type)
  values (
    p_supplier_id, p_warehouse_id, p_purchase_date, p_purchase_memo, v_actor, p_payment_method, p_delivery_method,
    coalesce(p_purchase_doc_no, nextval('public.purchase_orders_doc_no_seq')), p_tax_type, p_evidence_type
  )
  returning id into v_purchase_id;

  if jsonb_array_length(p_purchase_items) > 0 then
    insert into public.purchase_order_items (purchase_order_id, product_id, spec, quantity, unit_cost, remark, lot_number, remaining_quantity)
    select
      v_purchase_id,
      (item->>'productId')::uuid,
      nullif(item->>'spec', ''),
      (item->>'quantity')::numeric,
      (item->>'unitCost')::numeric,
      nullif(item->>'remark', ''),
      nullif(item->>'lotNumber', ''),
      (item->>'quantity')::numeric
    from jsonb_array_elements(p_purchase_items) as item;

    insert into public.inventory_transactions
      (product_id, warehouse_id, type, quantity, reference, purchase_order_id, created_by)
    select
      (item->>'productId')::uuid,
      p_warehouse_id,
      'in',
      (item->>'quantity')::numeric,
      'purchase_order:' || v_purchase_id,
      v_purchase_id,
      v_actor
    from jsonb_array_elements(p_purchase_items) as item;
  end if;

  insert into public.sales_orders
    (customer_id, warehouse_id, order_date, memo, created_by, payment_method, delivery_method, doc_no, tax_type, evidence_type)
  values (
    p_customer_id, p_warehouse_id, p_sale_date, p_sale_memo, v_actor, p_payment_method,
    coalesce(p_sale_delivery_method, p_delivery_method),
    coalesce(p_sale_doc_no, nextval('public.sales_orders_doc_no_seq')), p_tax_type, p_evidence_type
  )
  returning id into v_sale_id;

  if jsonb_array_length(p_sale_items) > 0 then
    -- 매출 줄마다 방금 만든 이 매입 로트에서 직접 소진한다(FIFO 이력 기록).
    -- 예전에는 매입 품목의 remaining_quantity를 채우지 않아(기본값 0) 이
    -- 기능으로 등록한 매입은 영구히 "이미 소진됨"으로 남아 매출을 지워도
    -- 매입을 삭제/수정할 수 없었고, 매출 쪽엔 소진 기록이 없어 매출을
    -- 지워도 되돌릴 게 없었다.
    for v_sale_item in select * from jsonb_array_elements(p_sale_items) loop
      insert into public.sales_order_items
        (sales_order_id, product_id, spec, quantity, unit_price, unit_cost, remark, lot_number)
      values (
        v_sale_id,
        (v_sale_item->>'productId')::uuid,
        nullif(v_sale_item->>'spec', ''),
        (v_sale_item->>'quantity')::numeric,
        (v_sale_item->>'unitPrice')::numeric,
        0,
        nullif(v_sale_item->>'remark', ''),
        nullif(v_sale_item->>'lotNumber', '')
      )
      returning id into v_sale_item_id;

      v_need := (v_sale_item->>'quantity')::numeric;
      v_cost_total := 0;
      v_cost_qty := 0;
      for v_lot in
        select poi.id, poi.remaining_quantity, poi.unit_cost
        from public.purchase_order_items poi
        where poi.purchase_order_id = v_purchase_id
          and poi.product_id = (v_sale_item->>'productId')::uuid
          and poi.remaining_quantity > 0
        order by poi.created_at asc, poi.id asc
        for update of poi
      loop
        exit when v_need <= 0;
        v_take := least(v_need, v_lot.remaining_quantity);

        update public.purchase_order_items
        set remaining_quantity = remaining_quantity - v_take
        where id = v_lot.id;

        insert into public.fifo_consumptions
          (purchase_order_item_id, consumed_quantity, consumed_unit_cost, consumed_by_type,
           sales_order_item_id, created_by)
        values (v_lot.id, v_take, v_lot.unit_cost, 'sale', v_sale_item_id, v_actor);

        v_cost_total := v_cost_total + v_take * v_lot.unit_cost;
        v_cost_qty := v_cost_qty + v_take;
        v_need := v_need - v_take;
      end loop;

      update public.sales_order_items
      set unit_cost = coalesce(
        round(v_cost_total / nullif(v_cost_qty, 0), 2),
        (select pr.cost from public.products pr where pr.id = (v_sale_item->>'productId')::uuid),
        0
      )
      where id = v_sale_item_id;
    end loop;

    insert into public.inventory_transactions
      (product_id, warehouse_id, type, quantity, reference, sales_order_id, created_by)
    select
      (item->>'productId')::uuid,
      p_warehouse_id,
      'out',
      (item->>'quantity')::numeric,
      'sales_order:' || v_sale_id,
      v_sale_id,
      v_actor
    from jsonb_array_elements(p_sale_items) as item;
  end if;

  return query select v_purchase_id, v_sale_id;
end;
$$;

-- create_stock_transfer_with_items: 시작할 때 내부 쓰기 표시를 켠다.
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
  perform set_config('app.internal_write', 'on', true);
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;
  if p_from_warehouse_id = p_to_warehouse_id then
    raise exception '출발 창고와 도착 창고가 같을 수 없습니다.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception '이동할 품목을 1개 이상 입력해주세요.';
  end if;
  if (select count(*) from public.warehouses where id in (p_from_warehouse_id, p_to_warehouse_id)) <> 2 then
    raise exception '창고를 찾을 수 없습니다.';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_product_id := (v_item->>'productId')::uuid;
    v_quantity := (v_item->>'quantity')::numeric;
    if v_quantity is null or v_quantity = 'NaN'::numeric or v_quantity <= 0 then
      raise exception '이동 수량은 0보다 커야 합니다.';
    end if;
  end loop;

  -- 같은 품목이 여러 줄이면 합산해서 출발 창고 재고와 비교한다.
  for v_product_id, v_quantity in
    select (item->>'productId')::uuid, sum((item->>'quantity')::numeric)
    from jsonb_array_elements(p_items) as item
    group by 1
  loop
    select i.quantity, p.name into v_available, v_product_name
    from public.inventory i
    join public.products p on p.id = v_product_id
    where i.product_id = v_product_id and i.warehouse_id = p_from_warehouse_id
    for update of i;

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
  select v_transfer_id, (item->>'productId')::uuid, (item->>'quantity')::numeric, nullif(item->>'remark', '')
  from jsonb_array_elements(p_items) as item;

  insert into public.inventory_transactions (product_id, warehouse_id, type, quantity, reference, note, created_by)
  select (item->>'productId')::uuid, p_from_warehouse_id, 'out', (item->>'quantity')::numeric,
         'stock_transfer:' || v_transfer_id, '창고 이동(출발)', v_actor
  from jsonb_array_elements(p_items) as item;

  insert into public.inventory_transactions (product_id, warehouse_id, type, quantity, reference, note, created_by)
  select (item->>'productId')::uuid, p_to_warehouse_id, 'in', (item->>'quantity')::numeric,
         'stock_transfer:' || v_transfer_id, '창고 이동(도착)', v_actor
  from jsonb_array_elements(p_items) as item;

  return v_transfer_id;
end;
$$;

-- delete_stock_transfer: 시작할 때 내부 쓰기 표시를 켠다.
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
  perform set_config('app.internal_write', 'on', true);
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;

  select created_by, from_warehouse_id, to_warehouse_id
    into v_owner, v_from_warehouse_id, v_to_warehouse_id
  from public.stock_transfers where id = p_id
  for update;

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

