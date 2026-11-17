-- "입고 불러오기" 연결 수량이 입고 수량을 넘지 못하게 저장 시점에 DB가 한 번 더 막는다.
--
-- 목록(앱)은 "입고 수량 − 연결된 판매 수량"으로 불러올 수 있는 만큼만 보여 주지만, 목록은 화면을 연 시점의 스냅샷이라
--  1) 두 사람이 같은 입고분을 열어 두고 각자 저장하거나, 2) 한 화면에서 같은 입고분을 두 번 불러와 저장하면 합계가 입고 수량을 넘을 수 있다.
-- 연결 기록(sales_order_items.source_purchase_item_id)이 들어가거나 바뀌는 순간 그 입고 품목 행을 잠그고(동시 저장은 순서대로 처리)
-- 연결 수량 합이 입고 수량을 넘으면 저장을 거절한다. 모든 저장 경로(등록/수정/동시등록)가 같은 테이블에 쓰므로 한 곳에서 막힌다.
create or replace function public.guard_purchase_link_capacity()
returns trigger
language plpgsql
as $$
declare
  v_capacity numeric;
  v_linked numeric;
begin
  if new.source_purchase_item_id is null then
    return new;
  end if;

  select poi.quantity into v_capacity
  from public.purchase_order_items poi
  where poi.id = new.source_purchase_item_id
  for update;

  if v_capacity is null then
    return new;
  end if;

  select coalesce(sum(soi.quantity), 0) into v_linked
  from public.sales_order_items soi
  where soi.source_purchase_item_id = new.source_purchase_item_id;

  if v_linked > v_capacity then
    raise exception '불러온 입고 수량을 넘었습니다. 이 입고분은 이미 다른 매출에 불러와져 남은 수량이 부족합니다. 입고 불러오기를 다시 눌러 남은 수량을 확인해 주세요.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_purchase_link_capacity on public.sales_order_items;
create constraint trigger guard_purchase_link_capacity
  after insert or update of quantity, source_purchase_item_id on public.sales_order_items
  deferrable initially immediate
  for each row execute function public.guard_purchase_link_capacity();
