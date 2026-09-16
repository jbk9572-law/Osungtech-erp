-- 랙 삭제(locations 행 삭제)가 inventory_locations를 on delete cascade로
-- 같이 지우고, 그 cascade 삭제가 다시 location_stock_history 기록 트리거를
-- 태운다. 이 트리거가 그 시점에 방금 지워진 locations.id를 그대로
-- location_id로 insert하려다가 FK 위반이 났다 — 같은 트랜잭션 안에서
-- locations 행이 이미 지워진 뒤라 그 id를 참조할 수 없기 때문("랙
-- 삭제에 실패했습니다: ... location_stock_history_location_id_fkey").
--
-- location_code(문자열 스냅샷)는 이미 있어서 표시에는 문제가 없으니,
-- 위치가 더는 존재하지 않는 경우(캐스케이드로 같이 지워진 경우)엔
-- location_id를 null로 남긴다 — location_stock_history.location_id는
-- on delete set null이라 이미 nullable이다.
create or replace function public.record_location_stock_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_location_id uuid := coalesce(new.location_id, old.location_id);
  v_product_id uuid := coalesce(new.product_id, old.product_id);
  v_location_code text;
  v_product_sku text;
  v_product_name text;
  v_product_spec text;
  v_previous numeric;
  v_new numeric;
  v_reason text := coalesce(current_setting('app.stock_reason', true), 'manual');
begin
  select code into v_location_code from public.locations where id = v_location_id;
  select sku, name, spec into v_product_sku, v_product_name, v_product_spec
    from public.products where id = v_product_id;

  if (tg_op = 'INSERT') then
    v_previous := null;
    v_new := new.quantity;
  elsif (tg_op = 'UPDATE') then
    v_previous := old.quantity;
    v_new := new.quantity;
  else
    v_previous := old.quantity;
    v_new := null;
  end if;

  insert into public.location_stock_history (
    location_id, location_code, product_id, product_sku, product_name, product_spec,
    previous_quantity, new_quantity, actor, reason
  ) values (
    -- 위치가 이미 지워졌으면(랙 삭제로 인한 cascade) 존재하지 않는 id를
    -- 참조할 수 없으니 null로 남긴다 — location_code는 그대로 남아있어
    -- 이력 문구는 정상 표시된다.
    case when v_location_code is null then null else v_location_id end,
    coalesce(v_location_code, '(삭제된 위치)'), v_product_id, v_product_sku, v_product_name,
    v_product_spec, v_previous, v_new, auth.uid(), v_reason
  );

  if (tg_op = 'DELETE') then
    return old;
  end if;
  return new;
end;
$$;
