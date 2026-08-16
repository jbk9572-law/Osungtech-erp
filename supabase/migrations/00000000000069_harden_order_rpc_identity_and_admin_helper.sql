-- [보안 감사 1/2] 관리자 판정을 하나의 함수로 모듈화한다.
--
-- 지금까지 "요청자가 admin인가"를 확인하는 로직이 profiles_update_by_admin
-- (migration 40)과 company_profile_update_admin(migration 53) 두 정책에
-- 완전히 동일한 서브쿼리로 각각 복사돼 있었다. 앞으로 admin 전용 정책을
-- 추가할 때마다 또 복사하면, 나중에 이 판정 기준이 바뀔 때(예: role 값 종류가
-- 늘어나는 경우) 몇 군데 있는지도 모른 채 일부만 고치고 넘어가기 쉽다.
-- is_admin() 하나로 모아두면 이 함수만 고치면 그걸 쓰는 모든 정책이 같이
-- 바뀐다.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles me
    where me.id = auth.uid() and me.role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

drop policy if exists "profiles_update_by_admin" on public.profiles;
create policy "profiles_update_by_admin" on public.profiles
  for update using (public.is_admin());

drop policy if exists "company_profile_update_admin" on public.company_profile;
create policy "company_profile_update_admin" on public.company_profile
  for update using (public.is_admin());

-- [보안 감사 2/2] 매출/매입 원자적 RPC가 "작성자/수정자/삭제자"를 클라이언트가
-- 보낸 p_created_by/p_updated_by/p_deleted_by 값을 그대로 믿고 저장하고
-- 있었다. 이 함수들은 security invoker라서(테이블 RLS가 "로그인만 하면
-- 전부 허용"이라) 로그인한 어떤 직원이든 브라우저 개발자도구로 Supabase
-- REST를 직접 호출하면서 이 값에 다른 사람의 uuid를 넣으면, 실제로는 자기가
-- 등록/수정/삭제한 거래인데도 다른 직원이 한 것처럼 이력을 조작할 수 있었다
-- (화면은 항상 로그인한 본인의 id만 보내므로 UI로는 절대 재현되지 않는
-- 버그다). 이제부터는 그 값을 무시하고 auth.uid()(요청의 실제 JWT
-- 주체)만 신뢰한다. 매개변수 이름/개수/타입은 그대로 둔다 — Postgres는
-- 매개변수 타입 목록이 같아야 "진짜 교체"로 보고, 하나라도 바뀌면 옛 버전을
-- 남긴 채 새 오버로드를 만들어버린다(migration 67에서 실제로 겪은 문제).
-- 인증되지 않은 세션에서는 애초에 auth.uid()가 null이라 아예 실행을
-- 막는다.

create or replace function public.create_sale_with_items(
  p_customer_id uuid,
  p_warehouse_id uuid,
  p_order_date date,
  p_memo text,
  p_created_by uuid, -- 더 이상 신뢰하지 않음. auth.uid()로 대체(아래 v_actor). 시그니처 유지 목적으로만 남김.
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
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;

  insert into public.sales_orders
    (customer_id, warehouse_id, order_date, memo, created_by, payment_method, delivery_method, doc_no)
  values (
    p_customer_id, p_warehouse_id, p_order_date, p_memo, v_actor, p_payment_method, p_delivery_method,
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
      v_actor
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
  p_created_by uuid, -- 더 이상 신뢰하지 않음. auth.uid()로 대체(아래 v_actor). 시그니처 유지 목적으로만 남김.
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
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;

  insert into public.purchase_orders
    (supplier_id, warehouse_id, purchase_date, memo, created_by, payment_method, delivery_method, doc_no)
  values (
    p_supplier_id, p_warehouse_id, p_purchase_date, p_memo, v_actor, p_payment_method, p_delivery_method,
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
      v_actor
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
  p_created_by uuid, -- 더 이상 신뢰하지 않음. auth.uid()로 대체(아래 v_actor). 시그니처 유지 목적으로만 남김.
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
    p_customer_id, p_warehouse_id, p_sale_date, p_sale_memo, v_actor, p_payment_method, p_delivery_method,
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
      v_actor
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
  p_updated_by uuid, -- 더 이상 신뢰하지 않음. auth.uid()로 대체(아래 v_actor). 시그니처 유지 목적으로만 남김.
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
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;

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
  select product_id, v_old_warehouse_id, 'adjustment', quantity, 'sales_order_reversal:' || p_id, v_actor
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
      v_actor
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
  p_updated_by uuid, -- 더 이상 신뢰하지 않음. auth.uid()로 대체(아래 v_actor). 시그니처 유지 목적으로만 남김.
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
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;

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

create or replace function public.delete_sale_with_items(
  p_id uuid,
  p_deleted_by uuid -- 더 이상 신뢰하지 않음. auth.uid()로 대체(아래 v_actor). 시그니처 유지 목적으로만 남김.
)
returns void
language plpgsql
as $$
declare
  v_warehouse_id uuid;
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;

  select warehouse_id into v_warehouse_id from public.sales_orders where id = p_id;
  if v_warehouse_id is null then
    raise exception '매출 거래를 찾을 수 없습니다.';
  end if;

  -- 매출은 "출고(out)"로 재고를 차감했으므로, 되돌릴 때는 그만큼 다시
  -- 더해준다(양수). 주문을 지우면 sales_order_items는 on delete cascade로
  -- 같이 사라지므로, 삭제 전에 미리 스냅샷을 떠서 되돌릴 수량을 확보한다.
  insert into public.inventory_transactions (product_id, warehouse_id, type, quantity, reference, created_by)
  select product_id, v_warehouse_id, 'adjustment', quantity, 'sales_order_reversal:' || p_id, v_actor
  from public.sales_order_items
  where sales_order_id = p_id;

  delete from public.sales_orders where id = p_id;
end;
$$;

create or replace function public.delete_purchase_with_items(
  p_id uuid,
  p_deleted_by uuid -- 더 이상 신뢰하지 않음. auth.uid()로 대체(아래 v_actor). 시그니처 유지 목적으로만 남김.
)
returns void
language plpgsql
as $$
declare
  v_warehouse_id uuid;
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;

  select warehouse_id into v_warehouse_id from public.purchase_orders where id = p_id;
  if v_warehouse_id is null then
    raise exception '매입 거래를 찾을 수 없습니다.';
  end if;

  -- 매입은 "입고(in)"로 재고를 늘렸으므로, 되돌릴 때는 그만큼 빼준다(음수).
  insert into public.inventory_transactions (product_id, warehouse_id, type, quantity, reference, created_by)
  select product_id, v_warehouse_id, 'adjustment', -quantity, 'purchase_order_reversal:' || p_id, v_actor
  from public.purchase_order_items
  where purchase_order_id = p_id;

  delete from public.purchase_orders where id = p_id;
end;
$$;
