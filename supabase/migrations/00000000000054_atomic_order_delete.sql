-- update_sale_with_items/update_purchase_with_items(migration 52)와 같은 이유로,
-- 매출/매입 "삭제"도 지금까지 앱 코드에서 품목/창고 정보 조회 → 주문 삭제
-- (품목은 on delete cascade로 같이 지워짐) → 재고 되돌리기(별도 insert)를
-- 각각 별도 요청으로 보내고 있었다. 주문 삭제는 성공했는데 그 다음 재고
-- 되돌리기 insert가 실패하면(네트워크 오류, 일시적 오류 등), 거래 기록은
-- 이미 사라졌지만 재고 수량은 그 거래만큼 틀어진 채로 남는다. 함수 하나로
-- 묶어 전체를 하나의 트랜잭션으로 처리한다.
create or replace function public.delete_sale_with_items(
  p_id uuid,
  p_deleted_by uuid
)
returns void
language plpgsql
as $$
declare
  v_warehouse_id uuid;
begin
  select warehouse_id into v_warehouse_id from public.sales_orders where id = p_id;
  if v_warehouse_id is null then
    raise exception '매출 거래를 찾을 수 없습니다.';
  end if;

  -- 매출은 "출고(out)"로 재고를 차감했으므로, 되돌릴 때는 그만큼 다시
  -- 더해준다(양수). 주문을 지우면 sales_order_items는 on delete cascade로
  -- 같이 사라지므로, 삭제 전에 미리 스냅샷을 떠서 되돌릴 수량을 확보한다.
  insert into public.inventory_transactions (product_id, warehouse_id, type, quantity, reference, created_by)
  select product_id, v_warehouse_id, 'adjustment', quantity, 'sales_order_reversal:' || p_id, p_deleted_by
  from public.sales_order_items
  where sales_order_id = p_id;

  delete from public.sales_orders where id = p_id;
end;
$$;

create or replace function public.delete_purchase_with_items(
  p_id uuid,
  p_deleted_by uuid
)
returns void
language plpgsql
as $$
declare
  v_warehouse_id uuid;
begin
  select warehouse_id into v_warehouse_id from public.purchase_orders where id = p_id;
  if v_warehouse_id is null then
    raise exception '매입 거래를 찾을 수 없습니다.';
  end if;

  -- 매입은 "입고(in)"로 재고를 늘렸으므로, 되돌릴 때는 그만큼 빼준다(음수).
  insert into public.inventory_transactions (product_id, warehouse_id, type, quantity, reference, created_by)
  select product_id, v_warehouse_id, 'adjustment', -quantity, 'purchase_order_reversal:' || p_id, p_deleted_by
  from public.purchase_order_items
  where purchase_order_id = p_id;

  delete from public.purchase_orders where id = p_id;
end;
$$;
