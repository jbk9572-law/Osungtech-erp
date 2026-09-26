-- 창고 이동(stock_transfers)의 출발 창고 재고 확인이 레이스컨디션에
-- 취약했다 — 전체 감사에서 발견.
--
-- migration 131의 주석은 "inventory.quantity의 0 미만 금지 체크 제약이
-- 안전장치로 작동한다"고 돼 있었지만, 그 제약은 migration 38(음수 재고
-- 허용)에서 이미 삭제되어 실제로는 존재하지 않는다. 즉 create_stock_
-- transfer_with_items()의 "select ... where ... 재고 확인 -> 부족하면
-- raise exception" 로직이 유일한 방어선인데, 그 select에 행 잠금이
-- 없어서 같은 창고·같은 품목을 대상으로 한 이동 전표 두 개가 거의
-- 동시에 들어오면 둘 다 "재고 충분" 판정을 통과한 뒤 순차 반영되어
-- 창고 재고가 음수로 내려갈 수 있다(에러 없이 조용히).
--
-- for update로 그 행을 잠가서, 동시에 들어온 두 번째 이동은 첫 번째
-- 트랜잭션이 커밋될 때까지 기다렸다가 갱신된 재고로 다시 확인하게
-- 만든다.
create or replace function public.create_stock_transfer_with_items(
  p_from_warehouse_id uuid,
  p_to_warehouse_id uuid,
  p_transfer_date date,
  p_memo text,
  p_items jsonb
)
returns uuid
language plpgsql
as $$
declare
  v_actor uuid := auth.uid();
  v_transfer_id uuid;
  v_item jsonb;
  v_product_id uuid;
  v_quantity numeric;
  v_available numeric;
  v_product_name text;
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;
  if p_from_warehouse_id = p_to_warehouse_id then
    raise exception '출발 창고와 도착 창고가 같을 수 없습니다.';
  end if;
  if jsonb_array_length(p_items) = 0 then
    raise exception '이동할 품목을 1개 이상 입력해주세요.';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_product_id := (v_item->>'productId')::uuid;
    v_quantity := (v_item->>'quantity')::numeric;

    select quantity, name into v_available, v_product_name
    from public.inventory i
    join public.products p on p.id = v_product_id
    where i.product_id = v_product_id and i.warehouse_id = p_from_warehouse_id
    for update of i;

    if v_available is null then
      select name into v_product_name from public.products where id = v_product_id;
      raise exception '"%"의 출발 창고 재고가 0이라 이동할 수 없습니다.', coalesce(v_product_name, '품목');
    end if;
    if v_available < v_quantity then
      raise exception '"%"의 출발 창고 재고(%)가 이동 수량(%)보다 적습니다.', v_product_name, v_available, v_quantity;
    end if;
  end loop;

  insert into public.stock_transfers (from_warehouse_id, to_warehouse_id, transfer_date, memo, created_by)
  values (p_from_warehouse_id, p_to_warehouse_id, p_transfer_date, p_memo, v_actor)
  returning id into v_transfer_id;

  insert into public.stock_transfer_items (stock_transfer_id, product_id, quantity, remark)
  select
    v_transfer_id,
    (item->>'productId')::uuid,
    (item->>'quantity')::numeric,
    nullif(item->>'remark', '')
  from jsonb_array_elements(p_items) as item;

  insert into public.inventory_transactions (product_id, warehouse_id, type, quantity, reference, note, created_by)
  select
    (item->>'productId')::uuid,
    p_from_warehouse_id,
    'out',
    (item->>'quantity')::numeric,
    'stock_transfer:' || v_transfer_id,
    '창고 이동(출발)',
    v_actor
  from jsonb_array_elements(p_items) as item;

  insert into public.inventory_transactions (product_id, warehouse_id, type, quantity, reference, note, created_by)
  select
    (item->>'productId')::uuid,
    p_to_warehouse_id,
    'in',
    (item->>'quantity')::numeric,
    'stock_transfer:' || v_transfer_id,
    '창고 이동(도착)',
    v_actor
  from jsonb_array_elements(p_items) as item;

  return v_transfer_id;
end;
$$;
