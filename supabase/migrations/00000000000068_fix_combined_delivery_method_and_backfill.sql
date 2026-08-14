-- 버그: "매입+매출 동시등록"(create_purchase_and_sale_with_items)에서
-- 매입(purchase_orders) insert는 진작 payment_method/delivery_method를
-- 받고 있었는데, 같은 함수 안의 매출(sales_orders) insert는
-- 00000000000061/64에서 그 두 컬럼을 넣는 걸 빠뜨려서 계속 null로
-- 저장되고 있었다. 매입단계 화면에서 고른 결제방법/납품방법이 같이
-- 등록되는 매출 전표에는 반영이 안 되는 버그였다 — 두 컬럼 다 채운다.
-- 매개변수 시그니처는 00000000000066과 동일하게 유지해야
-- create or replace가 진짜 교체로 동작한다(00000000000067 참고).
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

  insert into public.sales_orders
    (customer_id, warehouse_id, order_date, memo, created_by, payment_method, delivery_method, doc_no)
  values (
    p_customer_id, p_warehouse_id, p_sale_date, p_sale_memo, p_created_by, p_payment_method, p_delivery_method,
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

-- delivery_method 필드가 생기기 전(00000000000064 이전)에 등록된 옛
-- 거래는 전부 null로 남아있어 목록/등록 화면 모두 기본값 없이 "-"로만
-- 보였다. 지금 신규 등록 기본값과 맞춰 옛 거래도 채워둔다 — 매출은
-- 직납, 매입은 방문수령.
update public.sales_orders set delivery_method = '직납' where delivery_method is null;
update public.purchase_orders set delivery_method = '방문수령' where delivery_method is null;
