-- 284: 문서번호 회사별 유일 · 재고 거래일자 한국 시간 기준 · 실사 소수 수량
--
-- 1) 문서번호(doc_no): 지금은 전체 회사에서 하나뿐이어야 하는 유일 인덱스였다. 다른 회사가 같은 번호를
--    직접 입력하면 저장이 막히고(다른 회사에 그 번호가 있다는 사실까지 드러남), 회사별 번호 체계를 쓸 수도 없다.
--    회사(tenant_id) 안에서만 유일하게 바꾼다. 번호를 매기는 순번(sequence)은 그대로 두므로 기존 번호·자동 부여는 변하지 않는다.
drop index if exists public.sales_orders_doc_no_key;
create unique index if not exists sales_orders_tenant_doc_no_key on public.sales_orders (tenant_id, doc_no);
drop index if exists public.purchase_orders_doc_no_key;
create unique index if not exists purchase_orders_tenant_doc_no_key on public.purchase_orders (tenant_id, doc_no);

-- 2) 재고 거래일자: 전표 없이 생기는 입출고(창고이동·일시반출·실사)의 날짜가 서버 UTC 날짜(current_date)로 잡혀
--    한국 시간 새벽(00~09시)에는 어제 날짜로 찍혔다. 한국 날짜로 맞춘다.
create or replace function public.set_inventory_transaction_date()
returns trigger
language plpgsql
as $$
begin
  if new.transaction_date is null then
    new.transaction_date := coalesce(
      (select order_date from public.sales_orders where id = new.sales_order_id),
      (select purchase_date from public.purchase_orders where id = new.purchase_order_id),
      (new.created_at at time zone 'Asia/Seoul')::date,
      (now() at time zone 'Asia/Seoul')::date
    );
  end if;
  return new;
end;
$$;

alter table public.stock_loans alter column loan_date set default ((now() at time zone 'Asia/Seoul')::date);

-- 3) 실사 확정 수량: 정수 칸이라 소수 수량(kg·m 등)으로 실사하면 반올림되거나 저장이 실패했다.
--    수불부 함수의 수량 열도 정수로 선언돼 있어 소수 수량이 반올림돼 보였다.
alter table public.inventory_transactions alter column counted_absolute_quantity type numeric using counted_absolute_quantity::numeric;

drop function if exists public.get_product_ledger_rows(uuid, uuid, date, date);

create or replace function public.get_product_ledger_rows(
  p_product_id uuid,
  p_warehouse_id uuid default null,
  p_from date default null,
  p_to date default null
)
returns table (
  id uuid,
  warehouse_id uuid,
  type text,
  quantity numeric,
  transaction_date date,
  created_at timestamptz,
  reference text,
  note text,
  sales_order_id uuid,
  purchase_order_id uuid,
  created_by uuid,
  balance_after numeric
)
language sql
stable
as $$
  with scope as (
    select
      t.id, t.warehouse_id, t.type, t.quantity, t.transaction_date, t.created_at,
      t.reference, t.note, t.sales_order_id, t.purchase_order_id, t.created_by,
      t.counted_absolute_quantity,
      case when t.type = 'out' then -abs(t.quantity) else t.quantity end as signed_qty
    from public.inventory_transactions t
    where t.product_id = p_product_id
      and (p_warehouse_id is null or t.warehouse_id = p_warehouse_id)
      and (p_to is null or t.transaction_date <= p_to)
      -- RLS에만 맡기지 않고 여기서도 명시적으로 걸러준다 — 이 함수가
      -- get_inventory_cache_mismatches/recalculate_inventory_cache(둘 다
      -- security definer) 안에서 중첩 호출되면 그 순간엔 RLS가 적용되지
      -- 않기 때문이다(get_inventory_cache_mismatches의 기존 설계와 같은
      -- 이유 — 그 함수도 원래 이렇게 직접 걸렀다).
      and t.is_demo = public.is_demo_actor()
      and t.tenant_id = public.current_tenant_id()
  ),
  anchored as (
    select *,
      count(counted_absolute_quantity) over (
        partition by warehouse_id order by transaction_date, created_at
      ) as anchor_group
    from scope
  ),
  grouped as (
    select *,
      coalesce(
        max(counted_absolute_quantity) over (partition by warehouse_id, anchor_group),
        0
      ) as group_base,
      sum(case when counted_absolute_quantity is not null then 0 else signed_qty end) over (
        partition by warehouse_id, anchor_group
        order by transaction_date, created_at
        rows between unbounded preceding and current row
      ) as running_in_group
    from anchored
  ),
  per_row as (
    select *, group_base + running_in_group as own_warehouse_balance
    from grouped
  ),
  with_delta as (
    select *,
      own_warehouse_balance - coalesce(
        lag(own_warehouse_balance) over (partition by warehouse_id order by transaction_date, created_at),
        0
      ) as own_contribution
    from per_row
  ),
  final as (
    select *,
      sum(own_contribution) over (
        order by transaction_date, created_at
        rows between unbounded preceding and current row
      ) as balance_after
    from with_delta
  )
  select id, warehouse_id, type, quantity, transaction_date, created_at, reference, note,
    sales_order_id, purchase_order_id, created_by, balance_after
  from final
  where (p_from is null or transaction_date >= p_from)
  order by transaction_date, created_at;
$$;

revoke all on function public.get_product_ledger_rows(uuid, uuid, date, date) from public;
grant execute on function public.get_product_ledger_rows(uuid, uuid, date, date) to authenticated;
