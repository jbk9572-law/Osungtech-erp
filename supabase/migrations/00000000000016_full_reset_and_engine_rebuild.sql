-- 품목/매입/매출/재고 데이터를 전부 지우고, 재고 계산 엔진(트리거)도
-- 처음부터 다시 설치한다. 거래처(고객사/공급업체)·창고·카테고리·회사정보는
-- 그대로 남긴다.
--
-- 순서가 중요하다: sales_order_items/purchase_order_items.product_id는
-- "on delete restrict"라서 주문을 먼저 지워야 품목을 지울 수 있다.
delete from public.sales_orders;       -- sales_order_items는 cascade로 함께 삭제됨
delete from public.purchase_orders;    -- purchase_order_items는 cascade로 함께 삭제됨
delete from public.products;           -- inventory / inventory_transactions / customer_product_prices는 cascade로 함께 삭제됨

-- 재고 계산 엔진(트리거)을 처음부터 다시 설치한다.
-- inventory_transactions에 행이 insert될 때마다 inventory 수량을 갱신하는
-- 로직이다. type='out'이면 수량만큼 차감, 그 외(in/adjustment)는 그대로
-- 더한다.
create or replace function public.apply_inventory_transaction()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  delta integer;
begin
  delta := case
    when new.type = 'out' then -abs(new.quantity)
    else new.quantity
  end;

  insert into public.inventory (product_id, warehouse_id, quantity, updated_at)
  values (new.product_id, new.warehouse_id, delta, now())
  on conflict (product_id, warehouse_id)
  do update set
    quantity = public.inventory.quantity + excluded.quantity,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_inventory_transaction_created on public.inventory_transactions;
create trigger on_inventory_transaction_created
  after insert on public.inventory_transactions
  for each row execute procedure public.apply_inventory_transaction();
