-- "불러온 입고분에서 먼저 차감"(239·240)을 걷어낸다 — 문제의 뿌리를 고친다.
--
-- 문제: "이미 불러온 입고분인가?"를 재고 남은 수량(선입선출로 줄어드는 숫자)으로 판단하면, 불러온 입고분과 실제 차감된 입고분이 달라
--       같은 입고를 또 불러오거나 안 불러온 입고가 사라지는 구멍이 생긴다. 재고(원가 계산)와 서류 연결(불러오기)은 다른 개념이다.
-- 해결: 재고 차감은 예전 그대로 선입선출만 쓰고, "어느 입고 품목에서 불러왔는지"는 sales_order_items.source_purchase_item_id(연결 기록)로만 남긴다.
--       불러오기 목록의 남은 수량 = 입고 수량 − 그 입고 품목에 연결된 판매 수량 합(앱에서 계산). 판매를 수정/삭제하면 연결도 따라가 자동 복구된다.
--  1) 회사 옵션(deduct_picked_layer)과 판단 함수(tenant_behavior_enabled)를 제거한다.
--  2) consume_fifo_layers를 인자 8개짜리(선입선출 전용)로 되돌린다.
--  3) create/update_sale_with_items는 연결 기록 저장은 유지하고 차감 함수 호출만 8개 인자로 바꾼다.

update public.tenants
set disabled_features = array_remove(disabled_features, 'deduct_picked_layer')
where 'deduct_picked_layer' = any(disabled_features);

update public.platform_settings
set default_disabled_features = array_remove(default_disabled_features, 'deduct_picked_layer')
where 'deduct_picked_layer' = any(default_disabled_features);

drop function if exists public.consume_fifo_layers(uuid, numeric, text, uuid, uuid, uuid, text, uuid, uuid);
drop function if exists public.tenant_behavior_enabled(text);

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

revoke all on function public.consume_fifo_layers(uuid, numeric, text, uuid, uuid, uuid, text, uuid) from public;
grant execute on function public.consume_fifo_layers(uuid, numeric, text, uuid, uuid, uuid, text, uuid) to authenticated;

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
