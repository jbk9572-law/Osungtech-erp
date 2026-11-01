-- 범용 SaaS 확장 요청(불특정 다수 회사 도입 대비) 2번: 운영자(staff)와
-- 관리자(admin) 권한을 분리한다. 지금까지 "본인이 등록한 전표만 수정/
-- 삭제 가능"(created_by 체크)은 있었지만, 아래 두 가지는 로그인만 하면
-- 누구나 할 수 있었다:
--
--   1) recalculate_inventory_cache() — 재고 캐시를 원장 합계로 강제
--      덮어쓰는 함수. 잘못 누르면(또는 악의적으로) 캐시를 실제와
--      다르게 만들 여지는 없지만(항상 "정답"으로 맞추는 함수라 안전),
--      사용자 요청대로 "데이터 강제 조작" 계열 작업은 관리자 전용으로
--      명시적으로 막는다.
--   2) "마감된 과거 전표"의 수정/삭제 — 지금까지는 날짜와 무관하게
--      본인 전표면 언제든 고칠 수 있었다. 테넌트별로 마감일
--      (tenants.closing_date)을 두고, 그 날짜 이전 거래일자의 매출/
--      매입 전표는 관리자만 수정/삭제할 수 있게 막는다(일반 staff가
--      실수로 몇 달 전 마감된 장부를 건드리는 걸 방지).
--
-- FIFO 레이어/원장 앵커 계산 로직(migration 205/206)은 전혀 건드리지
-- 않는다 — 함수 맨 앞에 권한 검사 한 줄을 더 추가하는 것뿐이고, 검사를
-- 통과하면 기존 로직이 그대로 실행된다.

-- 1) 테넌트별 마감일 ---------------------------------------------------
-- null(기본값)이면 마감 제한이 전혀 없다 — 기존 테넌트(오성테크 등)는
-- 관리자가 직접 설정하기 전까지 지금까지와 동일하게 동작한다.
alter table public.tenants add column if not exists closing_date date;

comment on column public.tenants.closing_date is
  '이 날짜(포함) 이전 거래일자의 매출/매입 전표는 관리자만 수정/삭제할
   수 있다. null이면 제한 없음(기본값). 환경설정 > 기능 관리에서
   관리자가 설정한다.';

-- 2) recalculate_inventory_cache — 관리자 전용 ---------------------------
create or replace function public.recalculate_inventory_cache()
returns table (
  product_id uuid,
  warehouse_id uuid,
  sku text,
  name text,
  spec text,
  before_quantity numeric,
  after_quantity numeric
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception '재고 캐시 재계산은 관리자만 실행할 수 있습니다.';
  end if;

  return query
  with mismatches as (
    select * from public.get_inventory_cache_mismatches()
  ),
  fixed as (
    update public.inventory inv
    set quantity = m.computed, updated_at = now()
    from mismatches m
    where inv.product_id = m.product_id and inv.warehouse_id = m.warehouse_id
    returning inv.product_id, inv.warehouse_id, m.cached as before_quantity, inv.quantity::numeric as after_quantity
  )
  select f.product_id, f.warehouse_id, m.sku, m.name, m.spec, f.before_quantity, f.after_quantity
  from fixed f
  join mismatches m on m.product_id = f.product_id and m.warehouse_id = f.warehouse_id;
end;
$$;

-- 3) 마감일 이전 매입 전표 수정/삭제 — 관리자 전용 ------------------------
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
    select 1 from public.purchase_order_items
    where purchase_order_id = p_id and remaining_quantity < quantity
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
    select 1 from public.purchase_order_items
    where purchase_order_id = p_id and remaining_quantity < quantity
  ) then
    raise exception '이미 매출/로스 처리로 일부 소진된 매입 품목이 있어 이 전표는 삭제할 수 없습니다 — 먼저 해당 매출을 취소해주세요.';
  end if;

  insert into public.inventory_transactions (product_id, warehouse_id, type, quantity, reference, created_by)
  select product_id, v_warehouse_id, 'adjustment', -quantity, 'purchase_order_reversal:' || p_id, v_actor
  from public.purchase_order_items where purchase_order_id = p_id;

  delete from public.purchase_orders where id = p_id;
end;
$$;

-- 4) 마감일 이전 매출 전표 수정/삭제 — 관리자 전용 ------------------------
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
  select product_id, v_old_warehouse_id, 'adjustment',
    case when v_old_is_return then -quantity else quantity end,
    'sales_order_reversal:' || p_id, v_actor
  from public.sales_order_items
  where sales_order_id = p_id and product_id is not null;

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
  select product_id, v_warehouse_id, 'adjustment',
    case when v_is_return then -quantity else quantity end,
    'sales_order_reversal:' || p_id, v_actor
  from public.sales_order_items where sales_order_id = p_id;

  if not v_is_return then
    for v_item in select id from public.sales_order_items where sales_order_id = p_id loop
      perform public.release_fifo_consumption(v_item.id);
    end loop;
  end if;

  delete from public.sales_orders where id = p_id;
end;
$$;
