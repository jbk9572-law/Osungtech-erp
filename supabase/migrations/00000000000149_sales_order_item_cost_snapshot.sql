-- 손익계산서(reports/income-statement)의 매출원가가 거래 시점이 아니라
-- "지금" 상품 원가(products.cost)를 곱해서 나온다 — 전체 감사에서 발견.
-- sales_order_items에 판매 당시 원가 스냅샷이 없어서 매번 현재 원가를
-- 다시 곱하다 보니, 나중에 원가가 바뀌면 과거 달 손익계산서까지 조회
--시점에 따라 계속 달라지는 문제가 있었다(매출액/매출단가는 이미
-- unit_price로 스냅샷돼 있는데 원가만 안 그랬다).
--
-- sales_order_items.unit_cost를 추가해 판매 시점의 products.cost를 그대로
-- 찍어 넣는다. 이미 쌓여있는 기존 행은 판매 당시 원가를 알 방법이 없으니
-- (스냅샷 자체가 없었음) 현재 원가로 일괄 백필한다 — 과거 데이터의 정확한
-- 원가 복원은 불가능하고, 이 마이그레이션 이후 새로 생기는 매출부터 정확한
-- 스냅샷이 남는다.
alter table public.sales_order_items add column if not exists unit_cost numeric;

update public.sales_order_items i
set unit_cost = coalesce(p.cost, 0)
from public.products p
where i.product_id = p.id and i.unit_cost is null;

update public.sales_order_items
set unit_cost = 0
where unit_cost is null;

alter table public.sales_order_items alter column unit_cost set default 0;
alter table public.sales_order_items alter column unit_cost set not null;

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

-- create_sale_with_items/update_sale_with_items 말고 매출 품목을 직접
-- insert하는 곳이 하나 더 있었다 — "매입과 동시에 매출 등록"(알스토크 없이
-- 바로 출고하는 드랍십 방식) 콤보 RPC. 이 경로는 같은 거래 안에서 방금
-- 매입한 단가를 그대로 알고 있으므로, products.cost(현재 원가)로 대체
-- 추정할 필요 없이 이번에 실제로 매입한 단가를 정확히 원가로 스냅샷할 수
-- 있다 — 위 검증 로직이 이미 "매출 품목마다 같은 품목의 매입 수량이 매출
-- 수량 이상이어야 한다"를 보장하므로, 매출되는 모든 품목은 반드시 이번
-- 매입 품목에도 존재한다.
create or replace function public.create_purchase_and_sale_with_items(
  p_supplier_id uuid,
  p_customer_id uuid,
  p_warehouse_id uuid,
  p_purchase_date date,
  p_sale_date date,
  p_purchase_memo text,
  p_sale_memo text,
  p_created_by uuid, -- 신뢰하지 않음(migration 69 참고). 시그니처 유지 목적으로만 남김.
  p_purchase_items jsonb,
  p_sale_items jsonb,
  p_payment_method text default null,
  p_delivery_method text default null,
  p_purchase_doc_no bigint default null,
  p_sale_doc_no bigint default null,
  p_sale_delivery_method text default null
)
returns table (purchase_order_id uuid, sale_order_id uuid)
language plpgsql
as $$
declare
  v_purchase_id uuid;
  v_sale_id uuid;
  v_over_product_id uuid;
  v_actor uuid := auth.uid();
begin
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
    (supplier_id, warehouse_id, purchase_date, memo, created_by, payment_method, delivery_method, doc_no)
  values (
    p_supplier_id, p_warehouse_id, p_purchase_date, p_purchase_memo, v_actor, p_payment_method, p_delivery_method,
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
      v_actor
    from jsonb_array_elements(p_purchase_items) as item;
  end if;

  insert into public.sales_orders
    (customer_id, warehouse_id, order_date, memo, created_by, payment_method, delivery_method, doc_no)
  values (
    -- 매출 쪽 납품방법은 이제 p_sale_delivery_method를 우선 쓴다 — 화면이
    -- 아직 이 값을 안 보내는 옛 호출부라면(직접 RPC 호출 등) p_delivery_method로
    -- 되돌아간다.
    p_customer_id, p_warehouse_id, p_sale_date, p_sale_memo, v_actor, p_payment_method,
    coalesce(p_sale_delivery_method, p_delivery_method),
    coalesce(p_sale_doc_no, nextval('public.sales_orders_doc_no_seq'))
  )
  returning id into v_sale_id;

  if jsonb_array_length(p_sale_items) > 0 then
    insert into public.sales_order_items (sales_order_id, product_id, spec, quantity, unit_price, unit_cost, remark, lot_number)
    select
      v_sale_id,
      (item->>'productId')::uuid,
      nullif(item->>'spec', ''),
      (item->>'quantity')::numeric,
      (item->>'unitPrice')::numeric,
      coalesce(
        (
          select sum((p->>'quantity')::numeric * (p->>'unitCost')::numeric) / nullif(sum((p->>'quantity')::numeric), 0)
          from jsonb_array_elements(p_purchase_items) as p
          where (p->>'productId')::uuid = (item->>'productId')::uuid
        ),
        (select pr.cost from public.products pr where pr.id = (item->>'productId')::uuid),
        0
      ),
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
      v_actor
    from jsonb_array_elements(p_sale_items) as item;
  end if;

  return query select v_purchase_id, v_sale_id;
end;
$$;
