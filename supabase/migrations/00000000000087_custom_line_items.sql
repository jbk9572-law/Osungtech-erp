-- 매입/매출 한 줄을 실제 품목(product_id) 연결 없이, 이름만 직접 입력해서
-- 등록할 수 있게 한다 — "소프너 교체"처럼 재고로 추적할 물건이 아니라
-- 1회성 서비스/청구 항목은 품목관리에 등록하거나 재고 반영이 되면 안
-- 된다는 요청. product_id를 nullable로 바꾸고, 그 경우에만 쓰이는
-- custom_name을 추가한다. 최소 하나는 있어야 화면에 이름 없는 줄이
-- 생기지 않는다.

-- 이 아래는 재실행해도 안전하도록(IF NOT EXISTS / 존재 여부 확인 후 추가)
-- 짰다 — 앞부분만 실행된 채로 중간에 실패해도 처음부터 다시 돌리면 된다.

alter table public.sales_order_items
  alter column product_id drop not null;
alter table public.sales_order_items
  add column if not exists custom_name text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'sales_order_items_product_or_name'
  ) then
    alter table public.sales_order_items
      add constraint sales_order_items_product_or_name
      check (product_id is not null or custom_name is not null);
  end if;
end $$;

alter table public.purchase_order_items
  alter column product_id drop not null;
alter table public.purchase_order_items
  add column if not exists custom_name text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'purchase_order_items_product_or_name'
  ) then
    alter table public.purchase_order_items
      add constraint purchase_order_items_product_or_name
      check (product_id is not null or custom_name is not null);
  end if;
end $$;

-- inventory_transactions.product_id는 계속 not null이다 — 직접입력 줄은
-- 애초에 재고 이력 자체를 안 남긴다(아래 RPC들에서 product_id가 있는
-- 항목만 걸러서 삽입).

drop function if exists public.create_sale_with_items(
  uuid, uuid, date, text, uuid, jsonb, text, text, bigint, boolean, text, boolean
);

create or replace function public.create_sale_with_items(
  p_customer_id uuid,
  p_warehouse_id uuid,
  p_order_date date,
  p_memo text,
  p_created_by uuid, -- 신뢰하지 않음(migration 69 참고). 시그니처 유지 목적으로만 남김.
  p_items jsonb,
  p_payment_method text default null,
  p_delivery_method text default null,
  p_doc_no bigint default null,
  p_is_return boolean default false,
  p_return_reason text default null,
  p_is_carryover boolean default false
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

  insert into public.sales_orders
    (customer_id, warehouse_id, order_date, memo, created_by, payment_method, delivery_method, doc_no, is_return, return_reason, is_carryover)
  values (
    p_customer_id, p_warehouse_id, p_order_date, p_memo, v_actor, p_payment_method, p_delivery_method,
    coalesce(p_doc_no, nextval('public.sales_orders_doc_no_seq')), p_is_return,
    case when p_is_return then p_return_reason else null end,
    p_is_carryover
  )
  returning id into v_order_id;

  if jsonb_array_length(p_items) > 0 then
    insert into public.sales_order_items (sales_order_id, product_id, custom_name, spec, quantity, unit_price, remark, lot_number)
    select
      v_order_id,
      nullif(item->>'productId', '')::uuid,
      nullif(item->>'customName', ''),
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
      case when p_is_return then 'in' else 'out' end,
      (item->>'quantity')::numeric,
      'sales_order:' || v_order_id,
      v_order_id,
      v_actor
    from jsonb_array_elements(p_items) as item
    where nullif(item->>'productId', '') is not null;
  end if;

  return v_order_id;
end;
$$;

drop function if exists public.update_sale_with_items(
  uuid, uuid, uuid, date, text, uuid, jsonb, text, text, bigint, boolean, text, boolean
);

create or replace function public.update_sale_with_items(
  p_id uuid,
  p_customer_id uuid,
  p_warehouse_id uuid,
  p_order_date date,
  p_memo text,
  p_updated_by uuid, -- 신뢰하지 않음(migration 69 참고). 시그니처 유지 목적으로만 남김.
  p_items jsonb,
  p_payment_method text default null,
  p_delivery_method text default null,
  p_doc_no bigint default null,
  p_is_return boolean default null,
  p_return_reason text default null,
  p_is_carryover boolean default null
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
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;

  select warehouse_id, created_by, is_return, is_carryover
    into v_old_warehouse_id, v_owner, v_old_is_return, v_old_is_carryover
  from public.sales_orders where id = p_id;
  if v_old_warehouse_id is null then
    raise exception '매출 거래를 찾을 수 없습니다.';
  end if;
  if v_owner is distinct from v_actor and not public.is_admin() then
    raise exception '본인이 등록한 매출만 수정할 수 있습니다.';
  end if;

  v_new_is_return := coalesce(p_is_return, v_old_is_return);

  update public.sales_orders
  set customer_id = p_customer_id,
      warehouse_id = p_warehouse_id,
      order_date = p_order_date,
      memo = p_memo,
      payment_method = p_payment_method,
      delivery_method = p_delivery_method,
      doc_no = coalesce(p_doc_no, doc_no),
      is_return = v_new_is_return,
      return_reason = case when v_new_is_return then coalesce(p_return_reason, return_reason) else null end,
      is_carryover = coalesce(p_is_carryover, v_old_is_carryover)
  where id = p_id;

  -- 기존 품목을 되돌린다: 직접입력(product_id가 없는) 줄은 애초에 재고
  -- 이력이 없었으므로 되돌릴 것도 없다 — product_id가 있는 것만 되돌린다.
  insert into public.inventory_transactions (product_id, warehouse_id, type, quantity, reference, created_by)
  select product_id, v_old_warehouse_id, 'adjustment',
    case when v_old_is_return then -quantity else quantity end,
    'sales_order_reversal:' || p_id, v_actor
  from public.sales_order_items
  where sales_order_id = p_id and product_id is not null;

  delete from public.sales_order_items where sales_order_id = p_id;

  if jsonb_array_length(p_items) > 0 then
    insert into public.sales_order_items (sales_order_id, product_id, custom_name, spec, quantity, unit_price, remark, lot_number)
    select
      p_id,
      nullif(item->>'productId', '')::uuid,
      nullif(item->>'customName', ''),
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
      case when v_new_is_return then 'in' else 'out' end,
      (item->>'quantity')::numeric,
      'sales_order:' || p_id,
      p_id,
      v_actor
    from jsonb_array_elements(p_items) as item
    where nullif(item->>'productId', '') is not null;
  end if;

  return p_id;
end;
$$;

drop function if exists public.create_purchase_with_items(
  uuid, uuid, date, text, uuid, jsonb, text, text, bigint, boolean
);

create or replace function public.create_purchase_with_items(
  p_supplier_id uuid,
  p_warehouse_id uuid,
  p_purchase_date date,
  p_memo text,
  p_created_by uuid, -- 신뢰하지 않음(migration 69 참고). 시그니처 유지 목적으로만 남김.
  p_items jsonb,
  p_payment_method text default null,
  p_delivery_method text default null,
  p_doc_no bigint default null,
  p_is_carryover boolean default false
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
    (supplier_id, warehouse_id, purchase_date, memo, created_by, payment_method, delivery_method, doc_no, is_carryover)
  values (
    p_supplier_id, p_warehouse_id, p_purchase_date, p_memo, v_actor, p_payment_method, p_delivery_method,
    coalesce(p_doc_no, nextval('public.purchase_orders_doc_no_seq')), p_is_carryover
  )
  returning id into v_order_id;

  if jsonb_array_length(p_items) > 0 then
    insert into public.purchase_order_items (purchase_order_id, product_id, custom_name, spec, quantity, unit_cost, remark, lot_number)
    select
      v_order_id,
      nullif(item->>'productId', '')::uuid,
      nullif(item->>'customName', ''),
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
      v_actor
    from jsonb_array_elements(p_items) as item
    where nullif(item->>'productId', '') is not null;
  end if;

  return v_order_id;
end;
$$;

drop function if exists public.update_purchase_with_items(
  uuid, uuid, uuid, date, text, uuid, jsonb, text, text, bigint, boolean
);

create or replace function public.update_purchase_with_items(
  p_id uuid,
  p_supplier_id uuid,
  p_warehouse_id uuid,
  p_purchase_date date,
  p_memo text,
  p_updated_by uuid, -- 신뢰하지 않음(migration 69 참고). 시그니처 유지 목적으로만 남김.
  p_items jsonb,
  p_payment_method text default null,
  p_delivery_method text default null,
  p_doc_no bigint default null,
  p_is_carryover boolean default null
)
returns uuid
language plpgsql
as $$
declare
  v_old_warehouse_id uuid;
  v_owner uuid;
  v_old_is_carryover boolean;
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;

  select warehouse_id, created_by, is_carryover
    into v_old_warehouse_id, v_owner, v_old_is_carryover
  from public.purchase_orders where id = p_id;
  if v_old_warehouse_id is null then
    raise exception '매입 거래를 찾을 수 없습니다.';
  end if;
  if v_owner is distinct from v_actor and not public.is_admin() then
    raise exception '본인이 등록한 매입만 수정할 수 있습니다.';
  end if;

  update public.purchase_orders
  set supplier_id = p_supplier_id,
      warehouse_id = p_warehouse_id,
      purchase_date = p_purchase_date,
      memo = p_memo,
      payment_method = p_payment_method,
      delivery_method = p_delivery_method,
      doc_no = coalesce(p_doc_no, doc_no),
      is_carryover = coalesce(p_is_carryover, v_old_is_carryover)
  where id = p_id;

  -- 직접입력(product_id가 없는) 줄은 재고 이력이 없었으므로 되돌릴 것도
  -- 없다 — product_id가 있는 것만 되돌린다.
  insert into public.inventory_transactions (product_id, warehouse_id, type, quantity, reference, created_by)
  select product_id, v_old_warehouse_id, 'adjustment', -quantity, 'purchase_order_reversal:' || p_id, v_actor
  from public.purchase_order_items
  where purchase_order_id = p_id and product_id is not null;

  delete from public.purchase_order_items where purchase_order_id = p_id;

  if jsonb_array_length(p_items) > 0 then
    insert into public.purchase_order_items (purchase_order_id, product_id, custom_name, spec, quantity, unit_cost, remark, lot_number)
    select
      p_id,
      nullif(item->>'productId', '')::uuid,
      nullif(item->>'customName', ''),
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
      v_actor
    from jsonb_array_elements(p_items) as item
    where nullif(item->>'productId', '') is not null;
  end if;

  return p_id;
end;
$$;
