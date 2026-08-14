-- 등록 화면 맨 앞에 "No"(전표번호)를 노출해서 직접 입력하거나(비우면
-- 자동 채번) 인쇄되는 거래명세표의 No와 일치시킬 수 있게 한다. 매출은
-- 이미 doc_no가 있으니(00000000000020) 매입에도 동일한 패턴을 만든다.
create sequence if not exists public.purchase_orders_doc_no_seq;

alter table public.purchase_orders
  add column if not exists doc_no bigint;

do $$
declare
  r record;
  n bigint := 0;
begin
  for r in select id from public.purchase_orders where doc_no is null order by created_at loop
    n := n + 1;
    update public.purchase_orders set doc_no = n where id = r.id;
  end loop;
  perform setval('public.purchase_orders_doc_no_seq', greatest(n, 1), n > 0);
end $$;

alter table public.purchase_orders
  alter column doc_no set default nextval('public.purchase_orders_doc_no_seq'),
  alter column doc_no set not null;

create unique index if not exists purchase_orders_doc_no_key on public.purchase_orders (doc_no);

-- 로트(Lot) 단위로 관리하는 품목을 위한 관리번호. 품목 자체 속성이
-- 아니라 매입/매출 건마다 들어오는 로트가 달라질 수 있어 주문 품목
-- 테이블에 둔다.
alter table public.sales_order_items add column if not exists lot_number text;
alter table public.purchase_order_items add column if not exists lot_number text;

create or replace function public.create_sale_with_items(
  p_customer_id uuid,
  p_warehouse_id uuid,
  p_order_date date,
  p_memo text,
  p_created_by uuid,
  p_items jsonb,
  p_payment_method text default null,
  p_delivery_method text default null,
  p_doc_no bigint default null
)
returns uuid
language plpgsql
as $$
declare
  v_order_id uuid;
begin
  insert into public.sales_orders
    (customer_id, warehouse_id, order_date, memo, created_by, payment_method, delivery_method, doc_no)
  values (
    p_customer_id, p_warehouse_id, p_order_date, p_memo, p_created_by, p_payment_method, p_delivery_method,
    coalesce(p_doc_no, nextval('public.sales_orders_doc_no_seq'))
  )
  returning id into v_order_id;

  if jsonb_array_length(p_items) > 0 then
    insert into public.sales_order_items (sales_order_id, product_id, spec, quantity, unit_price, remark, lot_number)
    select
      v_order_id,
      (item->>'productId')::uuid,
      nullif(item->>'spec', ''),
      (item->>'quantity')::numeric,
      (item->>'unitPrice')::numeric,
      nullif(item->>'remark', ''),
      nullif(item->>'lotNumber', '')
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
  p_delivery_method text default null,
  p_doc_no bigint default null
)
returns uuid
language plpgsql
as $$
declare
  v_order_id uuid;
begin
  insert into public.purchase_orders
    (supplier_id, warehouse_id, purchase_date, memo, created_by, payment_method, delivery_method, doc_no)
  values (
    p_supplier_id, p_warehouse_id, p_purchase_date, p_memo, p_created_by, p_payment_method, p_delivery_method,
    coalesce(p_doc_no, nextval('public.purchase_orders_doc_no_seq'))
  )
  returning id into v_order_id;

  if jsonb_array_length(p_items) > 0 then
    insert into public.purchase_order_items (purchase_order_id, product_id, spec, quantity, unit_cost, remark, lot_number)
    select
      v_order_id,
      (item->>'productId')::uuid,
      nullif(item->>'spec', ''),
      (item->>'quantity')::numeric,
      (item->>'unitCost')::numeric,
      nullif(item->>'remark', ''),
      nullif(item->>'lotNumber', '')
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
  p_delivery_method text default null,
  p_purchase_doc_no bigint default null,
  p_sale_doc_no bigint default null
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

  insert into public.purchase_orders
    (supplier_id, warehouse_id, purchase_date, memo, created_by, payment_method, delivery_method, doc_no)
  values (
    p_supplier_id, p_warehouse_id, p_purchase_date, p_purchase_memo, p_created_by, p_payment_method, p_delivery_method,
    coalesce(p_purchase_doc_no, nextval('public.purchase_orders_doc_no_seq'))
  )
  returning id into v_purchase_id;

  if jsonb_array_length(p_purchase_items) > 0 then
    insert into public.purchase_order_items (purchase_order_id, product_id, spec, quantity, unit_cost, remark, lot_number)
    select
      v_purchase_id,
      (item->>'productId')::uuid,
      nullif(item->>'spec', ''),
      (item->>'quantity')::numeric,
      (item->>'unitCost')::numeric,
      nullif(item->>'remark', ''),
      nullif(item->>'lotNumber', '')
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

  insert into public.sales_orders (customer_id, warehouse_id, order_date, memo, created_by, doc_no)
  values (
    p_customer_id, p_warehouse_id, p_sale_date, p_sale_memo, p_created_by,
    coalesce(p_sale_doc_no, nextval('public.sales_orders_doc_no_seq'))
  )
  returning id into v_sale_id;

  if jsonb_array_length(p_sale_items) > 0 then
    insert into public.sales_order_items (sales_order_id, product_id, spec, quantity, unit_price, remark, lot_number)
    select
      v_sale_id,
      (item->>'productId')::uuid,
      nullif(item->>'spec', ''),
      (item->>'quantity')::numeric,
      (item->>'unitPrice')::numeric,
      nullif(item->>'remark', ''),
      nullif(item->>'lotNumber', '')
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
  p_delivery_method text default null,
  p_doc_no bigint default null
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
      delivery_method = p_delivery_method,
      doc_no = coalesce(p_doc_no, doc_no)
  where id = p_id;

  -- 매출은 "출고(out)"로 재고를 차감했으므로, 되돌릴 때는 그만큼 다시
  -- 더해준다(양수) — 기존 창고 기준으로 되돌려야 한다.
  insert into public.inventory_transactions (product_id, warehouse_id, type, quantity, reference, created_by)
  select product_id, v_old_warehouse_id, 'adjustment', quantity, 'sales_order_reversal:' || p_id, p_updated_by
  from public.sales_order_items
  where sales_order_id = p_id;

  delete from public.sales_order_items where sales_order_id = p_id;

  if jsonb_array_length(p_items) > 0 then
    insert into public.sales_order_items (sales_order_id, product_id, spec, quantity, unit_price, remark, lot_number)
    select
      p_id,
      (item->>'productId')::uuid,
      nullif(item->>'spec', ''),
      (item->>'quantity')::numeric,
      (item->>'unitPrice')::numeric,
      nullif(item->>'remark', ''),
      nullif(item->>'lotNumber', '')
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
  p_delivery_method text default null,
  p_doc_no bigint default null
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
      delivery_method = p_delivery_method,
      doc_no = coalesce(p_doc_no, doc_no)
  where id = p_id;

  -- 매입은 "입고(in)"로 재고를 늘렸으므로, 되돌릴 때는 그만큼 빼준다(음수)
  -- — 기존 창고 기준으로 되돌려야 한다.
  insert into public.inventory_transactions (product_id, warehouse_id, type, quantity, reference, created_by)
  select product_id, v_old_warehouse_id, 'adjustment', -quantity, 'purchase_order_reversal:' || p_id, p_updated_by
  from public.purchase_order_items
  where purchase_order_id = p_id;

  delete from public.purchase_order_items where purchase_order_id = p_id;

  if jsonb_array_length(p_items) > 0 then
    insert into public.purchase_order_items (purchase_order_id, product_id, spec, quantity, unit_cost, remark, lot_number)
    select
      p_id,
      (item->>'productId')::uuid,
      nullif(item->>'spec', ''),
      (item->>'quantity')::numeric,
      (item->>'unitCost')::numeric,
      nullif(item->>'remark', ''),
      nullif(item->>'lotNumber', '')
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
