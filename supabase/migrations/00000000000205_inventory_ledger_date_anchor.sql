-- 재고 입출고내역/수불부의 "재고 잔량" 계산이 근본적으로 틀려 있었다.
--
-- 실제 사례(사용자 제보): 9/3 재고실사로 500개를 맞춰놓고, 그 뒤 [9/23
-- 입고 +300] → [9/23 출고 -800] → [10/7 입고 +1000] → [10/30 출고 -300]
-- 순으로 정상 흐름을 타면 최종 700개가 맞다. 그런데 화면에 중간에 -100
-- 같은 "유령" 마이너스 잔량이 튀어나왔다.
--
-- 원인은 두 가지가 겹친 것이다:
--
-- 1) inventory_transactions에는 "진짜 거래일자"가 저장되지 않는다.
--    create_sale_with_items/create_purchase_with_items는 sales_orders.
--    order_date/purchase_orders.purchase_date(사용자가 고른 진짜 거래일)와
--    무관하게 inventory_transactions.created_at은 그냥 now()다. 실무에서는
--    전표를 그날 바로 입력하지 않고 며칠~몇 주 늦게(또는 미리) 입력하는
--    일이 흔한데, 지금까지 모든 "재고 잔량" 계산(/inventory/item/[id],
--    /inventory/count 실사 상세, 설정>변경이력, /reports/ledger 수불부와
--    그 엑셀 내보내기 — 전부 다 같은 패턴이라 한 곳만 고치지 않고 전부
--    같이 고친다)이 created_at 순서로 누적했다. 전표를 늦게/일찍 입력하면
--    실제 거래 순서와 달라져 중간 잔량이 완전히 틀어진다 — 로컬 Postgres로
--    이 시나리오를 실제로 재현해 확인했다(9/23 출고를 10/10에, 10/7 입고를
--    10/5에 입력한 것으로 재현하면 그대로 중간에 음수 잔량이 나온다).
--
-- 2) 재고실사가 "그 시점부터는 과거를 다 잊고 실사 수량을 새 기준점으로
--    삼는다"는 보장이 없었다. 조정도 일반 입출고와 똑같이 그냥 델타를
--    더하기만 해서, 실사 이전에 원인불명 오차(드리프트)가 조금이라도
--    있었으면 그 오차가 영구히 이후 모든 계산에 섞여 들어간다.
--
-- 그래서 두 가지를 모두 고친다:
--   A) inventory_transactions에 transaction_date(진짜 거래일자) 컬럼을
--      추가하고, insert 시 연결된 sales_orders/purchase_orders에서
--      자동으로 채운다(연결 없는 수기조정/실사는 created_at 날짜를 그대로
--      씀 — 지금까지의 동작과 동일). 거래일자 오름차순으로만 계산한다.
--   B) 재고실사(submitStockCount)가 남기는 조정 행에 그 실사 시점의
--      "확정 수량"(counted_absolute_quantity)을 같이 남긴다. 잔량 계산은
--      이 값이 있는 행을 만나면 그 이전 누적을 전부 버리고 그 값을 새
--      기준점으로 삼는다(헌법 요구사항: 실사는 리셋 지점).
--
-- 과거 전표를 수정해도(예: 매출 수정으로 order_date가 바뀜) 연쇄적으로
-- 반영되도록 sales_orders/purchase_orders의 날짜 컬럼에 AFTER UPDATE
-- 트리거를 달아 연결된 inventory_transactions.transaction_date를 같이
-- 갱신한다.

alter table public.inventory_transactions
  add column if not exists transaction_date date,
  add column if not exists counted_absolute_quantity integer;

comment on column public.inventory_transactions.transaction_date is
  '진짜 거래일자(매출/매입이면 그 전표의 order_date/purchase_date, 그 외
   수기조정/실사는 입력한 날) — 잔량 계산은 이 날짜 기준 오름차순으로만
   한다. created_at(시스템 입력시각)과 다를 수 있다(전표를 늦게/일찍
   입력하는 경우).';
comment on column public.inventory_transactions.counted_absolute_quantity is
  '재고실사(submitStockCount)로 생긴 조정 행에만 채워지는, 그 실사 시점의
   확정(절대) 수량. 잔량 계산에서 이 값이 있는 행은 "리셋 지점"이 되어
   그 이전 누적을 버리고 이 값을 새 기준으로 삼는다.';

-- 기존 행 백필 — 연결된 주문의 날짜, 없으면 created_at 날짜.
update public.inventory_transactions t
set transaction_date = coalesce(
  (select so.order_date from public.sales_orders so where so.id = t.sales_order_id),
  (select po.purchase_date from public.purchase_orders po where po.id = t.purchase_order_id),
  t.created_at::date
)
where t.transaction_date is null;

alter table public.inventory_transactions alter column transaction_date set not null;

create index if not exists inventory_transactions_product_txdate_idx
  on public.inventory_transactions (product_id, warehouse_id, transaction_date, created_at);

-- A) insert 시 거래일자 자동 채움.
create or replace function public.set_inventory_transaction_date()
returns trigger
language plpgsql
as $$
begin
  if new.transaction_date is null then
    new.transaction_date := coalesce(
      (select order_date from public.sales_orders where id = new.sales_order_id),
      (select purchase_date from public.purchase_orders where id = new.purchase_order_id),
      new.created_at::date,
      current_date
    );
  end if;
  return new;
end;
$$;

drop trigger if exists set_inventory_transaction_date_trg on public.inventory_transactions;
create trigger set_inventory_transaction_date_trg
  before insert on public.inventory_transactions
  for each row execute procedure public.set_inventory_transaction_date();

-- 과거 전표 수정 시 연쇄 갱신 — 매출/매입 수정으로 order_date/purchase_date가
-- 바뀌면 그 전표에 연결된 inventory_transactions.transaction_date도 같이 바뀐다.
create or replace function public.cascade_order_date_to_inventory_transactions()
returns trigger
language plpgsql
as $$
begin
  if tg_table_name = 'sales_orders' then
    if new.order_date is distinct from old.order_date then
      update public.inventory_transactions
      set transaction_date = new.order_date
      where sales_order_id = new.id;
    end if;
  elsif tg_table_name = 'purchase_orders' then
    if new.purchase_date is distinct from old.purchase_date then
      update public.inventory_transactions
      set transaction_date = new.purchase_date
      where purchase_order_id = new.id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists cascade_sales_order_date_trg on public.sales_orders;
create trigger cascade_sales_order_date_trg
  after update on public.sales_orders
  for each row execute procedure public.cascade_order_date_to_inventory_transactions();

drop trigger if exists cascade_purchase_order_date_trg on public.purchase_orders;
create trigger cascade_purchase_order_date_trg
  after update on public.purchase_orders
  for each row execute procedure public.cascade_order_date_to_inventory_transactions();

-- B) 거래일자 오름차순 + 창고별 실사 리셋을 반영한 원장(수불부) 전체 행
-- 계산. /inventory/item/[productId], /inventory/count 실사 상세,
-- 설정>변경이력, /reports/ledger 수불부(화면+엑셀) 5곳이 전부 이 하나의
-- 함수로 통일된다(기존엔 각 화면이 JS에서 따로 reduce를 돌려 로직이
-- 흩어져 있었다).
--
-- 계산 방식: (product_id, warehouse_id)별로 거래일자 오름차순 정렬 후,
-- counted_absolute_quantity가 있는 행을 만날 때마다 그 값을 그 창고의
-- 새 기준(anchor)으로 삼고 그 이전 누적은 버린다(anchor_group으로
-- 구간을 나눠, 각 구간의 "기준값 + 구간 내 델타 누적"이 그 창고의 그
-- 시점 잔량). 전체 창고 합산(p_warehouse_id가 null)이 필요하므로, 각
-- 행이 "자기 창고 잔량에 보탠 몫"(own_contribution = 그 창고의 직전
-- 잔량과의 차이 — 리셋이 일어났어도 그 몫만큼만 반영됨)을 구해서, 그
-- 몫들을 거래일자 전역 순서로 다시 누적하면 창고가 몇 개든 합산 잔량이
-- 나온다(가산의 교환법칙 — 어느 창고의 몫이든 더하는 순서는 결과에
-- 영향이 없다).
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
  quantity integer,
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

-- security definer가 아니다 — 호출자 권한 그대로 실행되어 RLS(tenant_id/
-- is_demo 격리)가 함수 안에서도 그대로 적용된다(get_ledger_opening_balance와
-- 같은 원칙).
revoke all on function public.get_product_ledger_rows(uuid, uuid, date, date) from public;
grant execute on function public.get_product_ledger_rows(uuid, uuid, date, date) to authenticated;

-- get_ledger_opening_balance도 같은 거래일자+앵커 기준으로 재작성한다
-- (이 함수를 쓰는 /reports/ledger, 그 엑셀 내보내기, /inventory/item/[id]가
-- 전부 같은 수정의 효과를 받는다). 전체 합산이 필요해 창고별로 "마지막
-- anchor 구간의 기준값+델타"만 구해 더한다(그 이전 구간은 리셋으로 이미
-- 버려졌으므로 무시해도 결과가 같다).
create or replace function public.get_ledger_opening_balance(
  p_product_id uuid,
  p_warehouse_id uuid default null,
  p_before timestamptz default now()
)
returns numeric
language sql
stable
as $$
  with scope as (
    select
      t.warehouse_id, t.counted_absolute_quantity, t.transaction_date, t.created_at,
      case when t.type = 'out' then -abs(t.quantity) else t.quantity end as signed_qty
    from public.inventory_transactions t
    where t.product_id = p_product_id
      and (p_warehouse_id is null or t.warehouse_id = p_warehouse_id)
      and t.transaction_date < p_before::date
      -- get_product_ledger_rows와 같은 이유로 RLS에만 맡기지 않고 명시
      -- 필터를 둔다(이 함수가 security definer 함수 안에서 중첩 호출될
      -- 때도 안전하도록).
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
    select warehouse_id, anchor_group,
      coalesce(max(counted_absolute_quantity), 0) as group_base,
      sum(case when counted_absolute_quantity is not null then 0 else signed_qty end) as group_delta
    from anchored
    group by warehouse_id, anchor_group
  ),
  latest as (
    select warehouse_id, group_base + group_delta as warehouse_balance,
      row_number() over (partition by warehouse_id order by anchor_group desc) as rn
    from grouped
  )
  select coalesce(sum(warehouse_balance), 0) from latest where rn = 1;
$$;

revoke all on function public.get_ledger_opening_balance(uuid, uuid, timestamptz) from public;
grant execute on function public.get_ledger_opening_balance(uuid, uuid, timestamptz) to authenticated;

-- 캐시 정합성 검증(get_inventory_cache_mismatches)도 "created_at 기준
-- 단순 전체합"이 아니라 같은 거래일자+앵커 기준 계산과 비교해야 한다 —
-- 그래야 실사로 이미 리셋된 과거 드리프트를 또 불일치로 잘못 보고하지
-- 않는다. (product_id, warehouse_id)별로 비교한다 — 기존엔 품목 단위로만
-- 합산 비교했는데, 창고별로 봐야 어느 창고가 틀렸는지 알 수 있다.
-- 기존 get_inventory_cache_mismatches()는 반환 행 모양이 다르다
-- (warehouse_id 컬럼이 없었다) — create or replace만으로는 OUT 파라미터
-- 구성이 다른 함수를 바꿀 수 없으므로(README.md "알아두면 유용한 함정들"
-- 참고) 먼저 지운다.
drop function if exists public.get_inventory_cache_mismatches();

create or replace function public.get_inventory_cache_mismatches()
returns table (
  product_id uuid,
  warehouse_id uuid,
  sku text,
  name text,
  spec text,
  cached numeric,
  computed numeric
)
language sql
security definer
set search_path = public
as $$
  select
    inv.product_id,
    inv.warehouse_id,
    p.sku,
    p.name,
    p.spec,
    inv.quantity as cached,
    coalesce(public.get_ledger_opening_balance(inv.product_id, inv.warehouse_id, 'infinity'::timestamptz), 0) as computed
  from public.inventory inv
  join public.products p on p.id = inv.product_id
  where inv.is_demo = public.is_demo_actor()
    and inv.tenant_id = public.current_tenant_id()
    and p.is_demo = public.is_demo_actor()
    and p.tenant_id = public.current_tenant_id()
    and inv.quantity <> coalesce(
      public.get_ledger_opening_balance(inv.product_id, inv.warehouse_id, 'infinity'::timestamptz), 0
    );
$$;

-- 자가치유: 위 불일치를 찾아서 실제로 캐시(inventory.quantity)를 이력
-- 합계(정답)에 맞춰 고친다. /inventory/count의 "무결성 검사 실행" 버튼이
-- 이제 읽기 전용 보고 대신 이 함수를 호출해 바로 고치고, 몇 건을 고쳤는지
-- 보여준다.
create or replace function public.recalculate_inventory_cache()
returns table (
  product_id uuid,
  warehouse_id uuid,
  sku text,
  name text,
  spec text,
  before_quantity numeric,
  after_quantity numeric
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with mismatches as (
    select * from public.get_inventory_cache_mismatches()
  ),
  fixed as (
    update public.inventory inv
    set quantity = m.computed, updated_at = now()
    from mismatches m
    where inv.product_id = m.product_id and inv.warehouse_id = m.warehouse_id
    returning inv.product_id, inv.warehouse_id, m.cached as before_quantity, inv.quantity::numeric as after_quantity
  )
  select f.product_id, f.warehouse_id, m.sku, m.name, m.spec, f.before_quantity, f.after_quantity
  from fixed f
  join mismatches m on m.product_id = f.product_id and m.warehouse_id = f.warehouse_id;
end;
$$;

revoke all on function public.get_inventory_cache_mismatches() from public;
grant execute on function public.get_inventory_cache_mismatches() to authenticated;
revoke all on function public.recalculate_inventory_cache() from public;
grant execute on function public.recalculate_inventory_cache() to authenticated;
