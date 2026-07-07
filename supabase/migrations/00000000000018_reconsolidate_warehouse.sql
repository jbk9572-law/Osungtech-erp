-- "재고가 부족하다"는 오류가 실제 재고보다 적은 수량을 팔 때도 발생한
-- 원인 조사 결과: 매출/매입/재고 화면들이 각자 "창고 1개를 골라오는" 쿼리를
-- order by 없이 limit 1로 실행하고 있었다. 만약 창고 테이블에 (병합 전
-- 이력 등으로) 행이 2개 이상 남아있다면, 화면마다 서로 다른 창고 행을
-- 골라올 수 있어 매입은 창고 A에, 매출 차감 시도는 창고 B(재고 0)에 대고
-- 이뤄지는 사고가 생길 수 있다. 재고현황 화면은 창고 구분 없이 모든 행의
-- 합을 보여주므로, 사용자 눈에는 "1120개 있는데 왜 부족하다는거야"로 보인다.
--
-- 00000000000014에서 이미 "오성테크" 창고 하나로 합치는 작업을 했지만,
-- 혹시 그 이후 다시 창고 행이 늘어났을 경우를 대비해 같은 통합 작업을
-- 한 번 더 안전하게(여러 번 실행해도 무해) 실행한다.
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

  insert into public.inventory (product_id, warehouse_id, quantity)
  select product_id, keeper_id, sum(quantity)
  from public.inventory
  where warehouse_id <> keeper_id
  group by product_id
  on conflict (product_id, warehouse_id)
  do update set quantity = public.inventory.quantity + excluded.quantity;

  delete from public.inventory where warehouse_id <> keeper_id;

  update public.sales_orders set warehouse_id = keeper_id where warehouse_id <> keeper_id;
  update public.purchase_orders set warehouse_id = keeper_id where warehouse_id <> keeper_id;
  update public.inventory_transactions set warehouse_id = keeper_id where warehouse_id <> keeper_id;

  delete from public.warehouses where id <> keeper_id;
end $$;

-- 확인용: 실행 후 창고가 정확히 1개인지, 그리고 특정 품목의 재고가
-- 창고별로 나뉘어 있지 않은지 아래 두 쿼리로 직접 확인할 수 있다.
-- select count(*) as warehouse_count from public.warehouses;
-- select p.sku, p.name, i.warehouse_id, i.quantity
--   from public.inventory i join public.products p on p.id = i.product_id
--   where p.name like '%품목명 일부%';
