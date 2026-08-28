-- 반품(오배송으로 되돌아온 매출) 지원.
--
-- 수량/단가는 그대로 양수로 등록하고(sales_order_items.quantity의
-- check (quantity > 0) 제약과 재고 트리거의 abs() 가드를 우회하는 "음수
-- 수량" 트릭은 쓰지 않는다), 대신 sales_orders에 is_return 플래그를 두고
-- 그 값에 따라 재고 방향(in/out)만 뒤집는다. 매출 합계·미수금·월별
-- 리포트·대시보드 등 금액을 다루는 곳은 이 플래그를 보고 부호를 뒤집어
-- 차감 처리한다(각 화면 쪽 코드에서 처리).
alter table public.sales_orders
  add column is_return boolean not null default false;

-- create_sale_with_items에 p_is_return을 추가한다. Postgres는 매개변수
-- 개수가 하나라도 바뀌면(기본값이 있는 매개변수를 추가하는 경우도 포함)
-- 기존 함수를 "교체"하는 게 아니라 새 오버로드를 만들어버리므로(migration
-- 67에서 실제로 겪은 문제, migration 69 주석 참고), 반드시 기존 시그니처를
-- 먼저 명시적으로 지운 뒤에 새 시그니처로 다시 만든다.
drop function if exists public.create_sale_with_items(
  uuid, uuid, date, text, uuid, jsonb, text, text, bigint
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
  p_is_return boolean default false
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
    (customer_id, warehouse_id, order_date, memo, created_by, payment_method, delivery_method, doc_no, is_return)
  values (
    p_customer_id, p_warehouse_id, p_order_date, p_memo, v_actor, p_payment_method, p_delivery_method,
    coalesce(p_doc_no, nextval('public.sales_orders_doc_no_seq')), p_is_return
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

    -- 반품이면 되돌려받는 것이므로 입고(in)로 재고를 늘리고, 정상 매출이면
    -- 지금까지처럼 출고(out)로 줄인다.
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

-- update_sale_with_items에도 같은 이유로 p_is_return을 추가한다.
-- p_is_return을 null로 보내면(예: 예전 호출부가 아직 있다면) 기존 값을
-- 그대로 유지한다 — 편집 중 반품 여부를 건드리지 않은 저장 요청이
-- 실수로 일반 매출로 되돌아가는 사고를 막기 위함.
drop function if exists public.update_sale_with_items(
  uuid, uuid, uuid, date, text, uuid, jsonb, text, text, bigint
);

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
  p_is_return boolean default null
)
returns uuid
language plpgsql
as $$
declare
  v_old_warehouse_id uuid;
  v_owner uuid;
  v_old_is_return boolean;
  v_new_is_return boolean;
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;

  select warehouse_id, created_by, is_return into v_old_warehouse_id, v_owner, v_old_is_return
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
      is_return = v_new_is_return
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

-- delete_sale_with_items는 매개변수를 바꾸지 않으므로(그대로 2개) 시그니처
-- 걱정 없이 몸통만 교체하면 된다 — is_return을 같이 조회해서 반품 건은
-- 반대 방향(음수)으로 되돌린다.
create or replace function public.delete_sale_with_items(
  p_id uuid,
  p_deleted_by uuid
)
returns void
language plpgsql
as $$
declare
  v_warehouse_id uuid;
  v_owner uuid;
  v_is_return boolean;
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;

  select warehouse_id, created_by, is_return into v_warehouse_id, v_owner, v_is_return
  from public.sales_orders where id = p_id;
  if v_warehouse_id is null then
    raise exception '매출 거래를 찾을 수 없습니다.';
  end if;
  if v_owner is distinct from v_actor and not public.is_admin() then
    raise exception '본인이 등록한 매출만 삭제할 수 있습니다.';
  end if;

  insert into public.inventory_transactions (product_id, warehouse_id, type, quantity, reference, created_by)
  select product_id, v_warehouse_id, 'adjustment',
    case when v_is_return then -quantity else quantity end,
    'sales_order_reversal:' || p_id, v_actor
  from public.sales_order_items
  where sales_order_id = p_id;

  delete from public.sales_orders where id = p_id;
end;
$$;
