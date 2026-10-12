-- 매출을 "샘플(무상증정)"로 등록할 수 있게 한다. 증빙유형만으로도 세금
-- 계산서 발행 대상에서는 빠지지만(evidence_type이 null/"세금계산서"가
-- 아니면 canIssueTaxInvoice()가 false), 매출목록/상세에서 "이 거래가 왜
-- 무상인지"를 바로 알아보고 거래처별 샘플 제공 이력을 나중에 따로 조회할
-- 수 있으려면 전용 플래그가 필요하다.
alter table public.sales_orders
  add column if not exists is_sample boolean not null default false;

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

  if jsonb_array_length(p_items) > 0 then
    insert into public.sales_order_items (sales_order_id, product_id, custom_name, spec, quantity, unit_price, unit_cost, remark, lot_number)
    select
      v_order_id,
      nullif(item->>'productId', '')::uuid,
      nullif(item->>'customName', ''),
      nullif(item->>'spec', ''),
      (item->>'quantity')::numeric,
      (item->>'unitPrice')::numeric,
      coalesce((select p.cost from public.products p where p.id = nullif(item->>'productId', '')::uuid), 0),
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
  set customer_id = p_customer_id,
      warehouse_id = p_warehouse_id,
      order_date = p_order_date,
      memo = p_memo,
      payment_method = p_payment_method,
      delivery_method = p_delivery_method,
      doc_no = coalesce(p_doc_no, doc_no),
      is_return = v_new_is_return,
      return_reason = case when v_new_is_return then coalesce(p_return_reason, return_reason) else null end,
      is_carryover = coalesce(p_is_carryover, v_old_is_carryover),
      tax_type = coalesce(p_tax_type, v_old_tax_type),
      evidence_type = p_evidence_type,
      is_sample = coalesce(p_is_sample, v_old_is_sample)
  where id = p_id;

  insert into public.inventory_transactions (product_id, warehouse_id, type, quantity, reference, created_by)
  select product_id, v_old_warehouse_id, 'adjustment',
    case when v_old_is_return then -quantity else quantity end,
    'sales_order_reversal:' || p_id, v_actor
  from public.sales_order_items
  where sales_order_id = p_id and product_id is not null;

  delete from public.sales_order_items where sales_order_id = p_id;

  if jsonb_array_length(p_items) > 0 then
    insert into public.sales_order_items (sales_order_id, product_id, custom_name, spec, quantity, unit_price, unit_cost, remark, lot_number)
    select
      p_id,
      nullif(item->>'productId', '')::uuid,
      nullif(item->>'customName', ''),
      nullif(item->>'spec', ''),
      (item->>'quantity')::numeric,
      (item->>'unitPrice')::numeric,
      coalesce((select p.cost from public.products p where p.id = nullif(item->>'productId', '')::uuid), 0),
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
