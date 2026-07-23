-- "매출도 같이 등록" 체크박스는 지금까지 매입/매출을 각각 별도의
-- supabase.rpc() 호출(create_purchase_with_items, create_sale_with_items)로
-- 만들었다. 각 rpc 호출은 PostgREST가 독립된 트랜잭션으로 처리하므로,
-- 매입 호출이 커밋된 뒤 매출 호출이 실패하면(잘못된 거래처, 네트워크
-- 오류 등) 매입만 영구히 남고 매출은 없는 불일치 상태가 될 수 있었다.
-- 마이그레이션 44에서 매입/매출 각각을 "여러 단계 요청 + 실패 시 수동
-- 되돌리기"에서 "함수 하나로 묶어 진짜 원자성 확보"로 고친 것과 동일한
-- 이유로, 이번에는 매입+매출 두 주문을 함수 하나로 묶어서 어느 쪽이든
-- 실패하면 전부 자동 롤백되게 한다.
--
-- 출고 수량은 매입 수량과 별도의 배열(p_sale_items)로 받는다 — 매입한
-- 수량 전부가 아니라 일부만 당일 출고되고 나머지는 재고로 남는 경우를
-- 지원하기 위해서다. 다만 품목별 출고 수량 합이 매입 수량 합을 넘으면
-- 실제로 없는 재고를 출고 처리하게 되므로, 실행 전에 검증해서 넘으면
-- 예외를 던져 전체를 롤백한다.
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
  p_sale_items jsonb
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

  insert into public.purchase_orders (supplier_id, warehouse_id, purchase_date, memo, created_by)
  values (p_supplier_id, p_warehouse_id, p_purchase_date, p_purchase_memo, p_created_by)
  returning id into v_purchase_id;

  if jsonb_array_length(p_purchase_items) > 0 then
    insert into public.purchase_order_items (purchase_order_id, product_id, spec, quantity, unit_cost, remark)
    select
      v_purchase_id,
      (item->>'productId')::uuid,
      nullif(item->>'spec', ''),
      (item->>'quantity')::numeric,
      (item->>'unitCost')::numeric,
      nullif(item->>'remark', '')
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

  insert into public.sales_orders (customer_id, warehouse_id, order_date, memo, created_by)
  values (p_customer_id, p_warehouse_id, p_sale_date, p_sale_memo, p_created_by)
  returning id into v_sale_id;

  if jsonb_array_length(p_sale_items) > 0 then
    insert into public.sales_order_items (sales_order_id, product_id, spec, quantity, unit_price, remark)
    select
      v_sale_id,
      (item->>'productId')::uuid,
      nullif(item->>'spec', ''),
      (item->>'quantity')::numeric,
      (item->>'unitPrice')::numeric,
      nullif(item->>'remark', '')
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
