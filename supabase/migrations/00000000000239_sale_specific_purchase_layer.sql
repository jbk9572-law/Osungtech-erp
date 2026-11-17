-- 매출 품목이 "어느 입고분(매입 품목)에서 나갔는지"를 지정할 수 있게 한다.
--
-- 배경: 지금은 매출을 등록하면 그 품목의 입고분 중 가장 오래된 날짜부터 자동으로 차감한다(선입선출, consume_fifo_layers).
-- 그런데 "입고 불러오기"는 사용자가 날짜를 골라 특정 입고분을 불러오는 것이라, 장부도 그 입고분에서 차감돼야 사용자의 의도와 맞고
-- (이미 출고한 입고분이 또 불러오기 목록에 남는 이중 출고 위험도 사라진다) 원가도 그 입고분 기준이 된다.
--
-- 방식:
--  1) sales_order_items.source_purchase_item_id — 지정한 입고분(없으면 null = 지금까지처럼 선입선출).
--  2) consume_fifo_layers에 선택 인자 p_preferred_purchase_item_id — 있으면 그 입고분에서 먼저 가능한 만큼 차감하고, 모자란 만큼만
--     기존 선입선출로 이어서 차감한다(출고가 막히지 않는다).
--  3) create_sale_with_items / update_sale_with_items가 품목 JSON의 sourcePurchaseItemId를 받아 저장하고 차감 함수에 넘긴다.
--     같은 품목(모품목 기준)의 입고분만 인정하고, 보이지 않는(다른 회사) 입고분은 RLS로 걸러져 무시된다.
-- 수정/삭제는 기존 fifo_consumptions 기록을 기준으로 되돌리므로(release_fifo_consumption) 별도 변경이 필요 없다.
-- 이미 등록된 매출은 source_purchase_item_id가 null이라 영향이 없다.

alter table public.sales_order_items
  add column if not exists source_purchase_item_id uuid references public.purchase_order_items(id) on delete set null;

create index if not exists sales_order_items_source_purchase_item_idx
  on public.sales_order_items (source_purchase_item_id)
  where source_purchase_item_id is not null;

-- 차감 함수: 인자를 하나 늘리므로 기존 정의를 지우고 다시 만든다(기본값이 있어 기존 호출부는 그대로 동작).
drop function if exists public.consume_fifo_layers(uuid, numeric, text, uuid, uuid, uuid, text, uuid);

create or replace function public.consume_fifo_layers(
  p_product_id uuid,
  p_quantity numeric,
  p_consumed_by_type text,
  p_sales_order_item_id uuid default null,
  p_loss_product_id uuid default null,
  p_loss_warehouse_id uuid default null,
  p_note text default null,
  p_created_by uuid default null,
  p_preferred_purchase_item_id uuid default null
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

  -- 지정한 입고분이 있으면 그 입고분에서 먼저 차감한다(같은 품목이고 남은 수량이 있을 때만).
  if p_preferred_purchase_item_id is not null then
    select poi.id, poi.remaining_quantity, poi.unit_cost
      into v_layer
    from public.purchase_order_items poi
    where poi.id = p_preferred_purchase_item_id
      and poi.product_id = p_product_id
      and poi.remaining_quantity > 0
    for update of poi;

    if found then
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
    end if;
  end if;

  -- 남은 수량은 기존 선입선출(오래된 입고분부터)로 차감한다.
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

revoke all on function public.consume_fifo_layers(uuid, numeric, text, uuid, uuid, uuid, text, uuid, uuid) from public;
grant execute on function public.consume_fifo_layers(uuid, numeric, text, uuid, uuid, uuid, text, uuid, uuid) to authenticated;

-- 매출 등록: 품목 JSON의 sourcePurchaseItemId를 저장하고 차감 함수에 넘긴다(206의 정의에서 이 부분만 바뀜).
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
  v_source_id uuid;
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

    v_parent_product_id := null;
    v_source_id := null;
    if v_product_id is not null then
      v_parent_product_id := coalesce(
        (select parent_product_id from public.products where id = v_product_id), v_product_id
      );
      -- 지정한 입고분은 같은 품목(모품목 기준)이고 내 회사에서 보이는 것만 인정한다(아니면 무시하고 선입선출).
      if not p_is_return then
        select poi.id into v_source_id
        from public.purchase_order_items poi
        where poi.id = nullif(v_item->>'sourcePurchaseItemId', '')::uuid
          and poi.product_id = v_parent_product_id;
      end if;
    end if;

    insert into public.sales_order_items
      (sales_order_id, product_id, custom_name, spec, quantity, unit_price, unit_cost, remark, lot_number, source_purchase_item_id)
    values (
      v_order_id, v_product_id, nullif(v_item->>'customName', ''), nullif(v_item->>'spec', ''),
      v_quantity, (v_item->>'unitPrice')::numeric,
      coalesce((select p.cost from public.products p where p.id = v_product_id), 0),
      nullif(v_item->>'remark', ''), nullif(v_item->>'lotNumber', ''), v_source_id
    )
    returning id into v_item_id;

    if v_product_id is not null then
      if p_is_return then
        -- 반품: FIFO 레이어를 되돌리지 않는다 — 어느 매출의 반품인지
        -- 연결되지 않은 자유 입력이라 정확한 역산이 불가능하다(알려진
        -- 한계, 추후 원매출 참조가 생기면 보강).
        insert into public.inventory_transactions
          (product_id, warehouse_id, type, quantity, reference, sales_order_id, created_by)
        values (v_parent_product_id, p_warehouse_id, 'in', v_quantity, 'sales_order:' || v_order_id, v_order_id, v_actor);
      else
        v_unit_cost := public.consume_fifo_layers(v_parent_product_id, v_quantity, 'sale', v_item_id, null, null, null, v_actor, v_source_id);
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

-- 매출 수정: 231의 정의에서 sourcePurchaseItemId 저장·전달만 추가(수정 화면이 기존 값을 다시 보내 같은 입고분이 유지된다).
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
  v_old_order_date date;
  v_closing_date date;
  v_actor uuid := auth.uid();
  v_old_item record;
  v_item jsonb;
  v_product_id uuid;
  v_parent_product_id uuid;
  v_quantity numeric;
  v_item_id uuid;
  v_unit_cost numeric;
  v_source_id uuid;
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;

  select warehouse_id, created_by, is_return, is_carryover, tax_type, is_sample, order_date
    into v_old_warehouse_id, v_owner, v_old_is_return, v_old_is_carryover, v_old_tax_type, v_old_is_sample, v_old_order_date
  from public.sales_orders where id = p_id;
  if v_old_warehouse_id is null then
    raise exception '매출 거래를 찾을 수 없습니다.';
  end if;
  if v_owner is distinct from v_actor and not public.is_admin() then
    raise exception '본인이 등록한 매출만 수정할 수 있습니다.';
  end if;

  if not public.is_admin() then
    select closing_date into v_closing_date from public.tenants where id = public.current_tenant_id();
    if v_closing_date is not null and v_old_order_date <= v_closing_date then
      raise exception '마감일(%) 이전 거래는 관리자만 수정할 수 있습니다.', to_char(v_closing_date, 'YYYY-MM-DD');
    end if;
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
  select coalesce(p.parent_product_id, i.product_id), v_old_warehouse_id, 'adjustment',
    case when v_old_is_return then -i.quantity else i.quantity end,
    'sales_order_reversal:' || p_id, v_actor
  from public.sales_order_items i
  left join public.products p on p.id = i.product_id
  where i.sales_order_id = p_id and i.product_id is not null;

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

      v_parent_product_id := null;
      v_source_id := null;
      if v_product_id is not null then
        v_parent_product_id := coalesce(
          (select parent_product_id from public.products where id = v_product_id), v_product_id);
        if not v_new_is_return then
          select poi.id into v_source_id
          from public.purchase_order_items poi
          where poi.id = nullif(v_item->>'sourcePurchaseItemId', '')::uuid
            and poi.product_id = v_parent_product_id;
        end if;
      end if;

      insert into public.sales_order_items
        (sales_order_id, product_id, custom_name, spec, quantity, unit_price, unit_cost, remark, lot_number, source_purchase_item_id)
      values (
        p_id, v_product_id, nullif(v_item->>'customName', ''), nullif(v_item->>'spec', ''),
        v_quantity, (v_item->>'unitPrice')::numeric,
        coalesce((select p.cost from public.products p where p.id = v_product_id), 0),
        nullif(v_item->>'remark', ''), nullif(v_item->>'lotNumber', ''), v_source_id
      )
      returning id into v_item_id;

      if v_product_id is not null then
        if v_new_is_return then
          insert into public.inventory_transactions
            (product_id, warehouse_id, type, quantity, reference, sales_order_id, created_by)
          values (v_parent_product_id, p_warehouse_id, 'in', v_quantity, 'sales_order:' || p_id, p_id, v_actor);
        else
          v_unit_cost := public.consume_fifo_layers(v_parent_product_id, v_quantity, 'sale', v_item_id, null, null, null, v_actor, v_source_id);
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
