-- "매입+매출 같이 등록"으로 만들어진 옛 매입 품목(remaining_quantity가
-- 0으로 잘못 남은 것)을 점검/복구한다. migration 228 이전 데이터용.
-- 운영 DB를 바꾸므로 자동 적용하지 않는다 — 1)번 조회 결과를 먼저 확인한 뒤
-- 2)번을 실행한다.

-- 1) 점검(읽기 전용): 남은수량이 "수량 - 기록된 소진량"과 안 맞는 매입 품목
select po.doc_no, po.purchase_date, poi.id as purchase_item_id, poi.quantity,
       poi.remaining_quantity,
       poi.quantity - coalesce((select sum(fc.consumed_quantity) from public.fifo_consumptions fc
                                where fc.purchase_order_item_id = poi.id), 0) as expected_remaining
from public.purchase_order_items poi
join public.purchase_orders po on po.id = poi.purchase_order_id
where poi.remaining_quantity <> poi.quantity - coalesce((select sum(fc.consumed_quantity)
      from public.fifo_consumptions fc where fc.purchase_order_item_id = poi.id), 0)
order by po.purchase_date desc;

-- 2) 복구: 소진 기록 없이 0으로 남은 품목의 남은수량을 되돌리고, 같은
-- 품목의 아직 소진 안 된 매출(드랍십과 같은 방식)과 다시 연결한다.
begin;
update public.purchase_order_items poi
set remaining_quantity = poi.quantity - coalesce((select sum(fc.consumed_quantity)
      from public.fifo_consumptions fc where fc.purchase_order_item_id = poi.id), 0)
where poi.remaining_quantity <> poi.quantity - coalesce((select sum(fc.consumed_quantity)
      from public.fifo_consumptions fc where fc.purchase_order_item_id = poi.id), 0);

select public.backfill_fifo_consumption_for_purchase(poi.id)
from public.purchase_order_items poi
where poi.remaining_quantity > 0 and poi.product_id is not null;
-- 결과를 확인한 뒤 commit; (되돌리려면 rollback;)
