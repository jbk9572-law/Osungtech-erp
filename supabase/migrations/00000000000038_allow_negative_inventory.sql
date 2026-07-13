-- 매입처 생산 상황에 따라 정확한 입고 수량이 확정되기 전에, 협의된 최소
-- 수량으로 먼저 매출 전표를 발행해야 하는 경우가 있다. 이때 재고가
-- 일시적으로 음수가 되는 것을 허용해야 하므로, inventory.quantity의
-- "0 이상" 제약을 제거한다. (프론트엔드는 여전히 부족 여부를 경고로
-- 보여주지만, 저장 자체를 막지는 않는다.)
alter table public.inventory
  drop constraint if exists inventory_quantity_check;
