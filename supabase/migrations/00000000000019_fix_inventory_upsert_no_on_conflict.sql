-- 오랜 진단 끝에 확인된 사실: 이 프로젝트의 Postgres에서는 어떤 이유에서인지
-- `insert ... on conflict (product_id, warehouse_id) do update ...` 구문이
-- 기존 행과의 충돌을 인식하지 못하고 매번 새 행을 insert하려다
-- inventory_quantity_check(수량 >= 0)에 걸려 실패했다. 유니크 제약을
-- 재생성해도, 트리거를 다시 설치해도 동일하게 재현되어 원인 불명으로 남았고,
-- 실제 프로덕션 SQL Editor에서 "on conflict" 없이 update-후-0행이면 insert
-- 방식으로 바꾸자 즉시 정상 동작하는 것을 확인했다 (이 파일은 그 수정을
-- 저장소에도 반영해 재설치 시에도 같은 방식이 유지되게 한다).
create or replace function public.apply_inventory_transaction()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  delta integer;
  updated_rows integer;
begin
  delta := case
    when new.type = 'out' then -abs(new.quantity)
    else new.quantity
  end;

  update public.inventory
  set quantity = quantity + delta, updated_at = now()
  where product_id = new.product_id and warehouse_id = new.warehouse_id;

  get diagnostics updated_rows = row_count;

  if updated_rows = 0 then
    insert into public.inventory (product_id, warehouse_id, quantity, updated_at)
    values (new.product_id, new.warehouse_id, delta, now());
  end if;

  return new;
end;
$$;
