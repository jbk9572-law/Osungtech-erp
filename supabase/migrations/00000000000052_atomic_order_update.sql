-- create_sale_with_items/create_purchase_with_items(migration 44)와 같은 이유로,
-- 매출/매입 "수정"도 지금까지 앱 코드에서 헤더 수정 → 재고 되돌리기 →
-- 기존 품목 삭제 → 새 품목 삽입 → 새 재고 반영을 각각 별도 요청으로
-- 보내고 있었다. 중간 단계(특히 "새 품목 삽입")가 실패하면 헤더는 이미
-- 새 값으로 바뀌고 재고는 이미 되돌려졌는데 품목이 0개인 상태로 남는
-- 심각한 불일치가 생길 수 있다. 함수 하나로 묶어 전체를 하나의 트랜잭션
--으로 처리한다.
create or replace function public.update_sale_with_items(
  p_id uuid,
  p_customer_id uuid,
  p_warehouse_id uuid,
  p_order_date date,
  p_memo text,
  p_updated_by uuid,
  p_items jsonb
)
returns uuid
language plpgsql
as $$
declare
  v_old_warehouse_id uuid;
begin
  select warehouse_id into v_old_warehouse_id from public.sales_orders where id = p_id;
  if v_old_warehouse_id is null then
    raise exception '매출 거래를 찾을 수 없습니다.';
  end if;

  update public.sales_orders
  set customer_id = p_customer_id,
      warehouse_id = p_warehouse_id,
      order_date = p_order_date,
      memo = p_memo
  where id = p_id;

  -- 매출은 "출고(out)"로 재고를 차감했으므로, 되돌릴 때는 그만큼 다시
  -- 더해준다(양수) — 기존 창고 기준으로 되돌려야 한다.
  insert into public.inventory_transactions (product_id, warehouse_id, type, quantity, reference, created_by)
  select product_id, v_old_warehouse_id, 'adjustment', quantity, 'sales_order_reversal:' || p_id, p_updated_by
  from public.sales_order_items
  where sales_order_id = p_id;

  delete from public.sales_order_items where sales_order_id = p_id;

  if jsonb_array_length(p_items) > 0 then
    insert into public.sales_order_items (sales_order_id, product_id, spec, quantity, unit_price, remark)
    select
      p_id,
      (item->>'productId')::uuid,
      nullif(item->>'spec', ''),
      (item->>'quantity')::numeric,
      (item->>'unitPrice')::numeric,
      nullif(item->>'remark', '')
    from jsonb_array_elements(p_items) as item;

    insert into public.inventory_transactions
      (product_id, warehouse_id, type, quantity, reference, sales_order_id, created_by)
    select
      (item->>'productId')::uuid,
      p_warehouse_id,
      'out',
      (item->>'quantity')::numeric,
      'sales_order:' || p_id,
      p_id,
      p_updated_by
    from jsonb_array_elements(p_items) as item;
  end if;

  return p_id;
end;
$$;

create or replace function public.update_purchase_with_items(
  p_id uuid,
  p_supplier_id uuid,
  p_warehouse_id uuid,
  p_purchase_date date,
  p_memo text,
  p_updated_by uuid,
  p_items jsonb
)
returns uuid
language plpgsql
as $$
declare
  v_old_warehouse_id uuid;
begin
  select warehouse_id into v_old_warehouse_id from public.purchase_orders where id = p_id;
  if v_old_warehouse_id is null then
    raise exception '매입 거래를 찾을 수 없습니다.';
  end if;

  update public.purchase_orders
  set supplier_id = p_supplier_id,
      warehouse_id = p_warehouse_id,
      purchase_date = p_purchase_date,
      memo = p_memo
  where id = p_id;

  -- 매입은 "입고(in)"로 재고를 늘렸으므로, 되돌릴 때는 그만큼 빼준다(음수)
  -- — 기존 창고 기준으로 되돌려야 한다.
  insert into public.inventory_transactions (product_id, warehouse_id, type, quantity, reference, created_by)
  select product_id, v_old_warehouse_id, 'adjustment', -quantity, 'purchase_order_reversal:' || p_id, p_updated_by
  from public.purchase_order_items
  where purchase_order_id = p_id;

  delete from public.purchase_order_items where purchase_order_id = p_id;

  if jsonb_array_length(p_items) > 0 then
    insert into public.purchase_order_items (purchase_order_id, product_id, spec, quantity, unit_cost, remark)
    select
      p_id,
      (item->>'productId')::uuid,
      nullif(item->>'spec', ''),
      (item->>'quantity')::numeric,
      (item->>'unitCost')::numeric,
      nullif(item->>'remark', '')
    from jsonb_array_elements(p_items) as item;

    insert into public.inventory_transactions
      (product_id, warehouse_id, type, quantity, reference, purchase_order_id, created_by)
    select
      (item->>'productId')::uuid,
      p_warehouse_id,
      'in',
      (item->>'quantity')::numeric,
      'purchase_order:' || p_id,
      p_id,
      p_updated_by
    from jsonb_array_elements(p_items) as item;
  end if;

  return p_id;
end;
$$;
