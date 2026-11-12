-- 매입 삭제가 "이미 매출/로스 처리로 소진됐다"고만 막히면, 사용자가 어느
-- 매출/로스가 이 매입을 붙잡고 있는지 알 수 없어(예: 연결된 매출을
-- 지웠는데도 안 풀리는 경우 — 다른 매출이 같은 로트를 소진 중이거나
-- 소급 연결(backfill)된 경우) 손쓸 방법이 없었다. 막을 때 실제로
-- 이 매입 로트를 소진 중인 매출(전표번호/거래처/날짜/수량)과 재고 로스
-- 수량을 메시지에 그대로 보여준다. 차단 조건 자체는 그대로다.
create or replace function public.purchase_lot_consumers_text(p_purchase_id uuid)
returns text
language sql
stable
as $$
  select coalesce(string_agg(part, ' / ' order by part), '')
  from (
    select
      case
        when fc.consumed_by_type = 'sale' then
          '매출 ' || coalesce('#' || so.doc_no::text || ' ', '') ||
          coalesce(c.name, '거래처 미상') || ' (' || to_char(so.order_date, 'YYYY-MM-DD') || ') ' ||
          fc.consumed_quantity::text
        else
          '재고 로스 ' || fc.consumed_quantity::text
      end as part
    from public.purchase_order_items poi
    join public.fifo_consumptions fc on fc.purchase_order_item_id = poi.id
    left join public.sales_order_items soi on soi.id = fc.sales_order_item_id
    left join public.sales_orders so on so.id = soi.sales_order_id
    left join public.customers c on c.id = so.customer_id
    where poi.purchase_order_id = p_purchase_id
  ) t;
$$;

create or replace function public.delete_purchase_with_items(p_id uuid, p_deleted_by uuid)
returns void
language plpgsql
as $$
declare
  v_warehouse_id uuid;
  v_owner uuid;
  v_purchase_date date;
  v_closing_date date;
  v_actor uuid := auth.uid();
  v_consumers text;
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;

  select warehouse_id, created_by, purchase_date into v_warehouse_id, v_owner, v_purchase_date
  from public.purchase_orders where id = p_id;
  if v_warehouse_id is null then
    raise exception '매입 거래를 찾을 수 없습니다.';
  end if;
  if v_owner is distinct from v_actor and not public.is_admin() then
    raise exception '본인이 등록한 매입만 삭제할 수 있습니다.';
  end if;

  if not public.is_admin() then
    select closing_date into v_closing_date from public.tenants where id = public.current_tenant_id();
    if v_closing_date is not null and v_purchase_date <= v_closing_date then
      raise exception '마감일(%) 이전 거래는 관리자만 삭제할 수 있습니다.', to_char(v_closing_date, 'YYYY-MM-DD');
    end if;
  end if;

  if exists (
    select 1 from public.purchase_order_items
    where purchase_order_id = p_id and remaining_quantity < quantity
  ) then
    v_consumers := public.purchase_lot_consumers_text(p_id);
    raise exception '이미 매출/로스 처리로 일부 소진된 매입 품목이 있어 이 전표는 삭제할 수 없습니다 — 먼저 해당 매출을 취소해주세요.%',
      case when v_consumers <> '' then ' [소진 내역: ' || v_consumers || ']'
           else ' [연결된 매출/로스 기록은 없는데 남은수량만 줄어 있습니다 — 관리자에게 재고 정합성 점검을 요청해주세요]' end;
  end if;

  insert into public.inventory_transactions (product_id, warehouse_id, type, quantity, reference, created_by)
  select product_id, v_warehouse_id, 'adjustment', -quantity, 'purchase_order_reversal:' || p_id, v_actor
  from public.purchase_order_items where purchase_order_id = p_id;

  delete from public.purchase_orders where id = p_id;
end;
$$;
