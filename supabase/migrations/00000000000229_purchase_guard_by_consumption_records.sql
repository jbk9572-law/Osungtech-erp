-- 이미 "매입+매출 같이 등록"으로 만들어진 매입(228 이전 데이터)은 남은수량이
-- 0으로 잘못 저장돼 있어 연결된 매출/로스 기록이 하나도 없는데도 영구히
-- 삭제/수정이 막혔다. "정말로 소진됐다"의 근거는 남은수량이 아니라 실제
-- 소진 기록(fifo_consumptions)이므로, 삭제/수정 차단을 "남은수량이 줄었고
-- 그 로트를 실제로 소진한 기록이 있는 품목이 있을 때"로만 좁힌다 — 진짜로
-- 매출/로스에 쓰인 매입은 그대로 막히고(227의 소진 내역 메시지 포함),
-- 기록 없이 남은수량만 틀어진 고아 상태는 풀린다. 시그니처는 그대로다.
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
  from public.purchase_order_items where purchase_order_id = p_id;

  delete from public.purchase_orders where id = p_id;
end;
$$;

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
  v_old_purchase_date date;
  v_closing_date date;
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;

  select warehouse_id, created_by, is_carryover, tax_type, purchase_date
    into v_old_warehouse_id, v_owner, v_old_is_carryover, v_old_tax_type, v_old_purchase_date
  from public.purchase_orders where id = p_id;
  if v_old_warehouse_id is null then
    raise exception '매입 거래를 찾을 수 없습니다.';
  end if;
  if v_owner is distinct from v_actor and not public.is_admin() then
    raise exception '본인이 등록한 매입만 수정할 수 있습니다.';
  end if;

  if not public.is_admin() then
    select closing_date into v_closing_date from public.tenants where id = public.current_tenant_id();
    if v_closing_date is not null and v_old_purchase_date <= v_closing_date then
      raise exception '마감일(%) 이전 거래는 관리자만 수정할 수 있습니다.', to_char(v_closing_date, 'YYYY-MM-DD');
    end if;
  end if;

  if exists (
    select 1 from public.purchase_order_items poi
    where poi.purchase_order_id = p_id and poi.remaining_quantity < poi.quantity
      and exists (select 1 from public.fifo_consumptions fc where fc.purchase_order_item_id = poi.id)
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
