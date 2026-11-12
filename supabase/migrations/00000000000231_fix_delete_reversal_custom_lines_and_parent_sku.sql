-- 231: 삭제/수정 시 재고 되돌림 두 가지 오류 수정
-- 1) 직접입력 줄(product_id 없음)이 있는 매출/매입 전표는 재고 되돌림 INSERT가 NOT NULL 위반으로
--    실패해 전표가 영구히 삭제되지 않았다(update_*에는 필터가 있었으나 delete_*에는 빠져 있었다).
-- 2) 파생 SKU(모품목 연결) 매출은 출고를 모품목 기준으로 쌓는데(206), 수정/삭제 시 되돌림은 자식 SKU에
--    쌓여 모품목 재고가 영구히 부족해지고 자식에 가짜 재고가 생겼다 — 되돌림도 모품목 기준으로 맞춘다.
-- 이미 잘못 쌓인 과거 되돌림 행은 자동 보정하지 않는다(운영 데이터 확인 후 별도 점검 필요).

create or replace function public.delete_sale_with_items(p_id uuid, p_deleted_by uuid)
returns void
language plpgsql
as $$
declare
  v_warehouse_id uuid;
  v_owner uuid;
  v_is_return boolean;
  v_order_date date;
  v_closing_date date;
  v_actor uuid := auth.uid();
  v_item record;
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;

  select warehouse_id, created_by, is_return, order_date into v_warehouse_id, v_owner, v_is_return, v_order_date
  from public.sales_orders where id = p_id;
  if v_warehouse_id is null then
    raise exception '매출 거래를 찾을 수 없습니다.';
  end if;
  if v_owner is distinct from v_actor and not public.is_admin() then
    raise exception '본인이 등록한 매출만 삭제할 수 있습니다.';
  end if;

  if not public.is_admin() then
    select closing_date into v_closing_date from public.tenants where id = public.current_tenant_id();
    if v_closing_date is not null and v_order_date <= v_closing_date then
      raise exception '마감일(%) 이전 거래는 관리자만 삭제할 수 있습니다.', to_char(v_closing_date, 'YYYY-MM-DD');
    end if;
  end if;

  insert into public.inventory_transactions (product_id, warehouse_id, type, quantity, reference, created_by)
  select coalesce(p.parent_product_id, i.product_id), v_warehouse_id, 'adjustment',
    case when v_is_return then -i.quantity else i.quantity end,
    'sales_order_reversal:' || p_id, v_actor
  from public.sales_order_items i
  left join public.products p on p.id = i.product_id
  where i.sales_order_id = p_id and i.product_id is not null;

  if not v_is_return then
    for v_item in select id from public.sales_order_items where sales_order_id = p_id loop
      perform public.release_fifo_consumption(v_item.id);
    end loop;
  end if;

  delete from public.sales_orders where id = p_id;
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
          (select parent_product_id from public.products where id = v_product_id), v_product_id);

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

create or replace function public.delete_purchase_with_items(p_id uuid, p_deleted_by uuid)
returns void
language plpgsql
as $$
declare
  v_warehouse_id uuid;
  v_owner uuid;
  v_purchase_date date;
  v_closing_date date;
  v_actor uuid := auth.uid();
  v_consumers text;
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;

  select warehouse_id, created_by, purchase_date into v_warehouse_id, v_owner, v_purchase_date
  from public.purchase_orders where id = p_id;
  if v_warehouse_id is null then
    raise exception '매입 거래를 찾을 수 없습니다.';
  end if;
  if v_owner is distinct from v_actor and not public.is_admin() then
    raise exception '본인이 등록한 매입만 삭제할 수 있습니다.';
  end if;

  if not public.is_admin() then
    select closing_date into v_closing_date from public.tenants where id = public.current_tenant_id();
    if v_closing_date is not null and v_purchase_date <= v_closing_date then
      raise exception '마감일(%) 이전 거래는 관리자만 삭제할 수 있습니다.', to_char(v_closing_date, 'YYYY-MM-DD');
    end if;
  end if;

  if exists (
    select 1 from public.purchase_order_items poi
    where poi.purchase_order_id = p_id and poi.remaining_quantity < poi.quantity
      and exists (select 1 from public.fifo_consumptions fc where fc.purchase_order_item_id = poi.id)
  ) then
    v_consumers := public.purchase_lot_consumers_text(p_id);
    raise exception '이미 매출/로스 처리로 일부 소진된 매입 품목이 있어 이 전표는 삭제할 수 없습니다 — 먼저 해당 매출을 취소해주세요.%',
      case when v_consumers <> '' then ' [소진 내역: ' || v_consumers || ']'
           else ' [연결된 매출/로스 기록은 없는데 남은수량만 줄어 있습니다 — 관리자에게 재고 정합성 점검을 요청해주세요]' end;
  end if;

  insert into public.inventory_transactions (product_id, warehouse_id, type, quantity, reference, created_by)
  select product_id, v_warehouse_id, 'adjustment', -quantity, 'purchase_order_reversal:' || p_id, v_actor
  from public.purchase_order_items where purchase_order_id = p_id and product_id is not null;

  delete from public.purchase_orders where id = p_id;
end;
$$;
