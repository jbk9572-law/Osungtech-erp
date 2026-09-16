-- 위치 이력에 "수정"이라고만 뜨는 게 아니라, 매출/매입 때문에 자동으로
-- 반영된 변경은 "입고"/"출고"로 구분해서 보여주기 위한 준비.
--
-- location_stock_history를 채우는 트리거(record_location_stock_history)는
-- inventory_locations가 어떻게 바뀌었는지(누가 호출했는지)는 알 수 없다.
-- 그래서 apply_location_stock_delta라는 함수를 하나 두고, 매출/매입 연동
-- (location-stock-sync.ts)이 inventory_locations를 직접 update/insert하는
-- 대신 항상 이 함수를 거치게 한다 — 이 함수가 반영 직전에 트랜잭션
-- 범위(set_config(..., true))로 "이번 변경은 입고냐 출고냐"를 남겨두면,
-- 같은 트랜잭션 안에서 트리거가 그 값을 읽어 이력에 같이 남길 수 있다.
-- 값을 안 남기면(수동 위치등록 화면처럼 이 함수를 거치지 않고 직접
-- update/delete하는 경우) 기존처럼 "수정"으로 남는다.

alter table public.location_stock_history
  add column if not exists reason text not null default 'manual'
    check (reason in ('manual', 'in', 'out'));

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
    v_location_id, coalesce(v_location_code, '(삭제된 위치)'), v_product_id, v_product_sku, v_product_name,
    v_product_spec, v_previous, v_new, auth.uid(), v_reason
  );

  if (tg_op = 'DELETE') then
    return old;
  end if;
  return new;
end;
$$;

-- 매출/매입 연동 전용 — 위치 재고를 상대값(delta)만큼 더하고(없으면
-- 새로 만들고), 방금 든 부호로 "이번 건은 입고냐 출고냐"를 트랜잭션
-- 범위에 남겨서 위 트리거가 이력에 같이 찍게 한다. RLS는 그대로 호출한
-- 사람 권한으로 적용된다(security definer 아님 — inventory_locations는
-- 이미 인증된 사용자면 누구나 쓸 수 있어 그대로 두는 게 맞다).
create or replace function public.apply_location_stock_delta(
  p_product_id uuid,
  p_location_id uuid,
  p_delta numeric
)
returns void
language plpgsql
as $$
begin
  if p_delta = 0 then
    return;
  end if;

  perform set_config('app.stock_reason', case when p_delta > 0 then 'in' else 'out' end, true);

  update public.inventory_locations
  set quantity = quantity + p_delta, updated_at = now()
  where product_id = p_product_id and location_id = p_location_id;

  if not found then
    insert into public.inventory_locations (product_id, location_id, quantity, updated_at)
    values (p_product_id, p_location_id, p_delta, now());
  end if;
end;
$$;
