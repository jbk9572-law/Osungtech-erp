-- 창고를 여러 개로 나누면서 재고가 창고별로 흩어져 헷갈리고, 실제로는
-- 창고를 구분해서 관리할 필요가 없다는 판단에 따라 "오성테크" 창고 하나만
-- 남기고 나머지 창고의 재고/주문 데이터를 전부 그 창고로 합친다.
--
-- 여러 번 실행해도 안전하다 (두 번째부터는 keeper 외 창고가 이미 없으므로
-- 아무 일도 일어나지 않는다).
do $$
declare
  keeper_id uuid;
begin
  select id into keeper_id
  from public.warehouses
  where name = '오성테크'
  order by created_at
  limit 1;

  if keeper_id is null then
    insert into public.warehouses (name)
    values ('오성테크')
    returning id into keeper_id;
  end if;

  -- 같은 품목이 여러 창고에 나뉘어 있으면 keeper 창고 수량으로 합산한다.
  insert into public.inventory (product_id, warehouse_id, quantity)
  select product_id, keeper_id, sum(quantity)
  from public.inventory
  where warehouse_id <> keeper_id
  group by product_id
  on conflict (product_id, warehouse_id)
  do update set quantity = public.inventory.quantity + excluded.quantity;

  delete from public.inventory where warehouse_id <> keeper_id;

  -- 기존 매출/매입 주문과 재고 이력의 창고 참조를 전부 keeper로 옮긴다.
  update public.sales_orders set warehouse_id = keeper_id where warehouse_id <> keeper_id;
  update public.purchase_orders set warehouse_id = keeper_id where warehouse_id <> keeper_id;
  update public.inventory_transactions set warehouse_id = keeper_id where warehouse_id <> keeper_id;

  -- 이제 아무 데서도 참조하지 않는 나머지 창고를 삭제한다.
  delete from public.warehouses where id <> keeper_id;
end $$;
