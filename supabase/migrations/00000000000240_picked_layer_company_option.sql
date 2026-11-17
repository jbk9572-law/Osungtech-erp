-- "불러온 입고분에서 먼저 차감"(239)을 회사별 옵션으로 만든다 — 모든 업종·회계 방식에 맞게 기본은 꺼짐(예전과 같은 선입선출).
--
-- 회사마다 재고 평가 방식(선입선출/개별법 등)이 다르므로, 불러온 입고분만 지정 차감하는 동작은 회사가 직접 켰을 때만 적용한다.
-- 기존 기능 토글 규칙(104, tenants.disabled_features: 목록에 있으면 꺼짐)을 그대로 따른다.
--  1) 기존 모든 회사의 disabled_features에 'deduct_picked_layer'를 넣어 끈다(켜려면 환경설정 > 기능 관리 > 업종별 동작 설정).
--  2) 새 회사의 기본값(platform_settings.default_disabled_features)에도 넣어 처음부터 꺼진 채로 시작한다.
--  3) 차감 함수가 이 설정을 확인한다 — 꺼져 있으면 지정 입고분이 와도 무시하고 선입선출(239 이전과 완전히 같은 동작).

-- 현재 회사에서 동작 토글이 켜져 있는지(꺼진 목록에 없으면 켜짐).
create or replace function public.tenant_behavior_enabled(p_key text)
returns boolean
language sql
stable
as $$
  select not (p_key = any(coalesce(
    (select t.disabled_features from public.tenants t where t.id = public.current_tenant_id()),
    '{}'::text[]
  )))
$$;

revoke all on function public.tenant_behavior_enabled(text) from public;
grant execute on function public.tenant_behavior_enabled(text) to authenticated;

update public.tenants
set disabled_features = array_append(disabled_features, 'deduct_picked_layer')
where not ('deduct_picked_layer' = any(disabled_features));

update public.platform_settings
set default_disabled_features = array_append(default_disabled_features, 'deduct_picked_layer')
where not ('deduct_picked_layer' = any(default_disabled_features));

-- 차감 함수: 239의 정의에서 "지정 입고분 우선" 조건에 회사 설정 확인만 추가한다(시그니처 동일).
create or replace function public.consume_fifo_layers(
  p_product_id uuid,
  p_quantity numeric,
  p_consumed_by_type text,
  p_sales_order_item_id uuid default null,
  p_loss_product_id uuid default null,
  p_loss_warehouse_id uuid default null,
  p_note text default null,
  p_created_by uuid default null,
  p_preferred_purchase_item_id uuid default null
)
returns numeric
language plpgsql
as $$
declare
  v_remaining numeric := p_quantity;
  v_total_cost numeric := 0;
  v_layer record;
  v_take numeric;
begin
  if p_quantity is null or p_quantity <= 0 then
    return 0;
  end if;

  -- 지정한 입고분이 있고 이 회사가 옵션을 켰을 때만, 그 입고분에서 먼저 차감한다(같은 품목이고 남은 수량이 있을 때).
  if p_preferred_purchase_item_id is not null and public.tenant_behavior_enabled('deduct_picked_layer') then
    select poi.id, poi.remaining_quantity, poi.unit_cost
      into v_layer
    from public.purchase_order_items poi
    where poi.id = p_preferred_purchase_item_id
      and poi.product_id = p_product_id
      and poi.remaining_quantity > 0
    for update of poi;

    if found then
      v_take := least(v_remaining, v_layer.remaining_quantity);

      update public.purchase_order_items
      set remaining_quantity = remaining_quantity - v_take
      where id = v_layer.id;

      insert into public.fifo_consumptions
        (purchase_order_item_id, consumed_quantity, consumed_unit_cost, consumed_by_type,
         sales_order_item_id, loss_product_id, loss_warehouse_id, note, created_by)
      values
        (v_layer.id, v_take, v_layer.unit_cost, p_consumed_by_type,
         p_sales_order_item_id, p_loss_product_id, p_loss_warehouse_id, p_note, p_created_by);

      v_total_cost := v_total_cost + v_take * v_layer.unit_cost;
      v_remaining := v_remaining - v_take;
    end if;
  end if;

  -- 남은 수량은 기존 선입선출(오래된 입고분부터)로 차감한다.
  for v_layer in
    select poi.id, poi.remaining_quantity, poi.unit_cost
    from public.purchase_order_items poi
    join public.purchase_orders po on po.id = poi.purchase_order_id
    where poi.product_id = p_product_id
      and poi.remaining_quantity > 0
    order by po.purchase_date asc, poi.created_at asc
    for update of poi
  loop
    exit when v_remaining <= 0;
    v_take := least(v_remaining, v_layer.remaining_quantity);

    update public.purchase_order_items
    set remaining_quantity = remaining_quantity - v_take
    where id = v_layer.id;

    insert into public.fifo_consumptions
      (purchase_order_item_id, consumed_quantity, consumed_unit_cost, consumed_by_type,
       sales_order_item_id, loss_product_id, loss_warehouse_id, note, created_by)
    values
      (v_layer.id, v_take, v_layer.unit_cost, p_consumed_by_type,
       p_sales_order_item_id, p_loss_product_id, p_loss_warehouse_id, p_note, p_created_by);

    v_total_cost := v_total_cost + v_take * v_layer.unit_cost;
    v_remaining := v_remaining - v_take;
  end loop;

  if v_remaining > 0 then
    v_total_cost := v_total_cost + v_remaining * coalesce(
      (select cost from public.products where id = p_product_id), 0
    );
  end if;

  return round(v_total_cost / p_quantity, 2);
end;
$$;
