-- 매입/매출 등록에 배송(입고)방법을 추가한다. payment_method와 동일한
-- 패턴: nullable text 컬럼, 등록 폼에서 값이 없으면 그냥 null로 남는다.
alter table public.sales_orders add column if not exists delivery_method text;
alter table public.purchase_orders add column if not exists delivery_method text;

-- create or replace function으로 매개변수를 "끝에 기본값과 함께" 추가하는
-- 것은 시그니처를 그대로 유지하는 진짜 교체다(PostgreSQL 공식 지원 방식) —
-- 기존 호출부가 새 인자를 안 넘겨도 계속 동작한다.
create or replace function public.create_sale_with_items(
  p_customer_id uuid,
  p_warehouse_id uuid,
  p_order_date date,
  p_memo text,
  p_created_by uuid,
  p_items jsonb,
  p_payment_method text default null,
  p_delivery_method text default null
)
returns uuid
language plpgsql
as $$
declare
  v_order_id uuid;
begin
  insert into public.sales_orders (customer_id, warehouse_id, order_date, memo, created_by, payment_method, delivery_method)
  values (p_customer_id, p_warehouse_id, p_order_date, p_memo, p_created_by, p_payment_method, p_delivery_method)
  returning id into v_order_id;

  if jsonb_array_length(p_items) > 0 then
    insert into public.sales_order_items (sales_order_id, product_id, spec, quantity, unit_price, remark)
    select
      v_order_id,
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
      'sales_order:' || v_order_id,
      v_order_id,
      p_created_by
    from jsonb_array_elements(p_items) as item;
  end if;

  return v_order_id;
end;
$$;

create or replace function public.create_purchase_with_items(
  p_supplier_id uuid,
  p_warehouse_id uuid,
  p_purchase_date date,
  p_memo text,
  p_created_by uuid,
  p_items jsonb,
  p_payment_method text default null,
  p_delivery_method text default null
)
returns uuid
language plpgsql
as $$
declare
  v_order_id uuid;
begin
  insert into public.purchase_orders (supplier_id, warehouse_id, purchase_date, memo, created_by, payment_method, delivery_method)
  values (p_supplier_id, p_warehouse_id, p_purchase_date, p_memo, p_created_by, p_payment_method, p_delivery_method)
  returning id into v_order_id;

  if jsonb_array_length(p_items) > 0 then
    insert into public.purchase_order_items (purchase_order_id, product_id, spec, quantity, unit_cost, remark)
    select
      v_order_id,
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
      'purchase_order:' || v_order_id,
      v_order_id,
      p_created_by
    from jsonb_array_elements(p_items) as item;
  end if;

  return v_order_id;
end;
$$;

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
  p_delivery_method text default null
)
returns table (purchase_order_id uuid, sale_order_id uuid)
language plpgsql
as $$
declare
  v_purchase_id uuid;
  v_sale_id uuid;
  v_over_product_id uuid;
begin
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

  insert into public.purchase_orders (supplier_id, warehouse_id, purchase_date, memo, created_by, payment_method, delivery_method)
  values (p_supplier_id, p_warehouse_id, p_purchase_date, p_purchase_memo, p_created_by, p_payment_method, p_delivery_method)
  returning id into v_purchase_id;

  if jsonb_array_length(p_purchase_items) > 0 then
    insert into public.purchase_order_items (purchase_order_id, product_id, spec, quantity, unit_cost, remark)
    select
      v_purchase_id,
      (item->>'productId')::uuid,
      nullif(item->>'spec', ''),
      (item->>'quantity')::numeric,
      (item->>'unitCost')::numeric,
      nullif(item->>'remark', '')
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
      p_created_by
    from jsonb_array_elements(p_purchase_items) as item;
  end if;

  insert into public.sales_orders (customer_id, warehouse_id, order_date, memo, created_by)
  values (p_customer_id, p_warehouse_id, p_sale_date, p_sale_memo, p_created_by)
  returning id into v_sale_id;

  if jsonb_array_length(p_sale_items) > 0 then
    insert into public.sales_order_items (sales_order_id, product_id, spec, quantity, unit_price, remark)
    select
      v_sale_id,
      (item->>'productId')::uuid,
      nullif(item->>'spec', ''),
      (item->>'quantity')::numeric,
      (item->>'unitPrice')::numeric,
      nullif(item->>'remark', '')
    from jsonb_array_elements(p_sale_items) as item;

    insert into public.inventory_transactions
      (product_id, warehouse_id, type, quantity, reference, sales_order_id, created_by)
    select
      (item->>'productId')::uuid,
      p_warehouse_id,
      'out',
      (item->>'quantity')::numeric,
      'sales_order:' || v_sale_id,
      v_sale_id,
      p_created_by
    from jsonb_array_elements(p_sale_items) as item;
  end if;

  return query select v_purchase_id, v_sale_id;
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
  p_delivery_method text default null
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
      memo = p_memo,
      payment_method = p_payment_method,
      delivery_method = p_delivery_method
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
  p_items jsonb,
  p_payment_method text default null,
  p_delivery_method text default null
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
      memo = p_memo,
      payment_method = p_payment_method,
      delivery_method = p_delivery_method
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
