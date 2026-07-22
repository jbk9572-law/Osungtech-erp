-- 판매/매입 등록은 지금까지 "주문 insert → 품목 insert → 재고 insert"를
-- 앱 코드에서 각각 별도 요청으로 보내고, 중간 단계가 실패하면 앞 단계를
-- 수동으로 delete해서 되돌리는 방식(베스트에포트 보상)이었다. 이 보상
-- delete 자체가 실패하면(네트워크 순단 등) 고아 데이터가 남을 수 있다.
-- 함수 하나로 묶으면 Postgres가 함수 호출 전체를 하나의 트랜잭션으로
-- 처리해서, 중간에 어디서 실패하든 전부 자동으로 롤백된다(진짜 원자성).
-- security invoker(기본값)라서 호출한 사용자의 권한 그대로 실행되고, 각
-- 테이블의 기존 RLS insert 정책(authenticated)이 똑같이 적용된다.
create or replace function public.create_sale_with_items(
  p_customer_id uuid,
  p_warehouse_id uuid,
  p_order_date date,
  p_memo text,
  p_created_by uuid,
  p_items jsonb
)
returns uuid
language plpgsql
as $$
declare
  v_order_id uuid;
begin
  insert into public.sales_orders (customer_id, warehouse_id, order_date, memo, created_by)
  values (p_customer_id, p_warehouse_id, p_order_date, p_memo, p_created_by)
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
  p_items jsonb
)
returns uuid
language plpgsql
as $$
declare
  v_order_id uuid;
begin
  insert into public.purchase_orders (supplier_id, warehouse_id, purchase_date, memo, created_by)
  values (p_supplier_id, p_warehouse_id, p_purchase_date, p_memo, p_created_by)
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
