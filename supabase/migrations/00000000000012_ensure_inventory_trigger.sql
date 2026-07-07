-- 재고 반영 트리거 재확인/재설치.
--
-- inventory_transactions에 행이 insert될 때마다 inventory 테이블의 수량을
-- 실제로 갱신하는 트리거(001_init_schema.sql에서 최초 생성)가 어떤 이유로든
-- 누락되어 있으면, 거래(매출/매입/재고조정)는 성공한 것처럼 보이는데 실제
-- 재고 수량은 전혀 바뀌지 않는 증상이 발생한다. 이 파일은 몇 번을 다시
-- 실행해도 안전하도록(create or replace / drop-then-create) 작성되어,
-- 트리거가 이미 있어도 없어도 실행 후에는 반드시 존재하도록 만든다.

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
