-- 그동안 창고가 나뉘어 있으면서 꼬인 재고 수량을 전부 0으로 초기화한다.
-- 이후 매입(입고)/매출(출고)/재고조정 거래가 새로 들어올 때마다
-- apply_inventory_transaction 트리거가 0을 기준으로 다시 정확하게 쌓아 올린다.
update public.inventory set quantity = 0;
