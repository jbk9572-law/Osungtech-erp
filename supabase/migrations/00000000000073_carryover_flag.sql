-- 이월(carryover) 처리 방식 전환.
--
-- 지금까지는 거래일자(order_date/purchase_date)를 실제 처리일이 아니라
-- 회계상 반영하고 싶은 미래 달의 날짜로 직접 입력해서 이월을 표현했다
-- (암묵적 — 대시보드의 isCarryover()가 "order_date의 달이 created_at의
-- 달보다 나중"인지로 역추적해서 판정). 이 방식은 거래일자 자체가 실제
-- 처리일과 달라져서 달력/명세표에 실제 날짜가 안 보이는 문제가 있었다.
--
-- 이제부터는 거래일자에 항상 실제 처리일을 그대로 쓰고, "다음 달 실적으로
-- 잡을지"는 별도의 is_carryover 플래그로 명시적으로 관리한다. 리포트/
-- 대시보드 집계는 "order_date의 달 + is_carryover면 다음 달"을 실적월로
-- 보도록 애플리케이션 코드에서 같이 바뀐다(각 화면 쪽 커밋 참고).
alter table public.sales_orders
  add column is_carryover boolean not null default false;

alter table public.purchase_orders
  add column is_carryover boolean not null default false;

-- 기존에 암묵적으로 이월 처리해둔 건을 한 번에 새 방식으로 전환한다:
-- 거래일자를 실제 등록일(created_at의 한국 시간 기준 날짜)로 되돌리고
-- is_carryover를 켠다. 판정 기준은 지금까지 대시보드가 쓰던 것과 동일하다
-- (order_date의 "YYYY-MM"이 등록일의 "YYYY-MM"보다 나중인 경우).
update public.sales_orders
set is_carryover = true,
    order_date = (created_at at time zone 'Asia/Seoul')::date
where to_char(order_date, 'YYYY-MM') > to_char((created_at at time zone 'Asia/Seoul')::date, 'YYYY-MM');

update public.purchase_orders
set is_carryover = true,
    purchase_date = (created_at at time zone 'Asia/Seoul')::date
where to_char(purchase_date, 'YYYY-MM') > to_char((created_at at time zone 'Asia/Seoul')::date, 'YYYY-MM');

-- create_sale_with_items / update_sale_with_items에 p_is_carryover를
-- 추가한다. 매개변수 개수가 바뀌면 Postgres가 기존 함수를 교체하지 않고
-- 새 오버로드를 만들어버리므로(migration 67 참고), 기존 시그니처를 먼저
-- 명시적으로 지운다.
drop function if exists public.create_sale_with_items(
  uuid, uuid, date, text, uuid, jsonb, text, text, bigint, boolean, text
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
      case when p_is_return then 'in' else 'out' end,
      (item->>'quantity')::numeric,
      'sales_order:' || v_order_id,
      v_order_id,
      v_actor
    from jsonb_array_elements(p_items) as item;
  end if;

  return v_order_id;
end;
$$;

drop function if exists public.update_sale_with_items(
  uuid, uuid, uuid, date, text, uuid, jsonb, text, text, bigint, boolean, text
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

  -- 기존 품목을 되돌린다: 이전에 반품(in)으로 늘렸던 거면 그만큼 다시
  -- 빼주고(음수), 정상 매출(out)로 줄였던 거면 다시 더해준다(양수) —
  -- 기존 창고 기준으로 되돌려야 한다.
  insert into public.inventory_transactions (product_id, warehouse_id, type, quantity, reference, created_by)
  select product_id, v_old_warehouse_id, 'adjustment',
    case when v_old_is_return then -quantity else quantity end,
    'sales_order_reversal:' || p_id, v_actor
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
      case when v_new_is_return then 'in' else 'out' end,
      (item->>'quantity')::numeric,
      'sales_order:' || p_id,
      p_id,
      v_actor
    from jsonb_array_elements(p_items) as item;
  end if;

  return p_id;
end;
$$;

-- create_purchase_with_items / update_purchase_with_items에도 동일하게
-- p_is_carryover를 추가한다.
drop function if exists public.create_purchase_with_items(
  uuid, uuid, date, text, uuid, jsonb, text, text, bigint
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
      v_actor
    from jsonb_array_elements(p_items) as item;
  end if;

  return v_order_id;
end;
$$;

drop function if exists public.update_purchase_with_items(
  uuid, uuid, uuid, date, text, uuid, jsonb, text, text, bigint
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

  -- 매입은 "입고(in)"로 재고를 늘렸으므로, 되돌릴 때는 그만큼 빼준다(음수)
  -- — 기존 창고 기준으로 되돌려야 한다.
  insert into public.inventory_transactions (product_id, warehouse_id, type, quantity, reference, created_by)
  select product_id, v_old_warehouse_id, 'adjustment', -quantity, 'purchase_order_reversal:' || p_id, v_actor
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
      v_actor
    from jsonb_array_elements(p_items) as item;
  end if;

  return p_id;
end;
$$;
