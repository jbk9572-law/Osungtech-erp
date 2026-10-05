-- migration 163에서 전환 추적을 customer_orders(주문 단위)에서
-- customer_order_items(품목 단위)로 옮기면서, customer_orders.work_order_id는
-- 더 이상 채워지지 않는다. 그런데 포털 조회 함수 3개
-- (portal_get_order/portal_list_orders/portal_get_order_process_steps)는
-- 여전히 그 컬럼으로 work_orders를 join하고 있어서, 품목이 전환돼도
-- 포털에서는 "생산 단계 없음"으로 계속 보이는 회귀가 생겼다(163에서
-- 고친 버그와 같은 종류 — 한 군데를 고치면서 같은 패턴을 쓰는 다른
-- 호출부를 놓친 사례). 세 함수 모두 품목 단위로 다시 집계한다.

-- 주문 하나에 제조품이 여러 개면 work_orders도 여러 개 생길 수 있다 —
-- "생산중"인 품목이 하나라도 있으면 전체를 아직 진행 중으로, 전부
-- completed여야 완료로 본다(가장 덜 진행된 것 기준 — 고객 입장에서는
-- 모든 품목이 끝나야 "생산완료"다).
create or replace function public.portal_get_order(p_order_id uuid)
returns table (
  id uuid, doc_no bigint, status text, memo text, reject_reason text, created_at timestamptz,
  work_order_status text, shipping_status text, shipped_at timestamptz, delivered_at timestamptz
)
language sql
security definer set search_path = public
stable
as $$
  select
    o.id, o.doc_no, o.status, o.memo, o.reject_reason, o.created_at,
    (
      select case
        when bool_or(wo.status = 'pending') then 'pending'
        when bool_or(wo.status = 'material_issued') then 'material_issued'
        when bool_or(wo.status = 'completed') then 'completed'
        else null
      end
      from public.customer_order_items i
      join public.work_orders wo on wo.id = i.work_order_id
      where i.customer_order_id = o.id
    ) as work_order_status,
    o.shipping_status, o.shipped_at, o.delivered_at
  from public.customer_portal_accounts a
  join public.customer_orders o on o.customer_id = a.customer_id
  where a.user_id = auth.uid() and not a.disabled and o.id = p_order_id;
$$;

create or replace function public.portal_list_orders()
returns table (
  id uuid, doc_no bigint, status text, memo text, created_at timestamptz,
  work_order_status text, shipping_status text, item_count bigint, total_amount numeric
)
language sql
security definer set search_path = public
stable
as $$
  select
    o.id, o.doc_no, o.status, o.memo, o.created_at,
    (
      select case
        when bool_or(wo.status = 'pending') then 'pending'
        when bool_or(wo.status = 'material_issued') then 'material_issued'
        when bool_or(wo.status = 'completed') then 'completed'
        else null
      end
      from public.customer_order_items i2
      join public.work_orders wo on wo.id = i2.work_order_id
      where i2.customer_order_id = o.id
    ) as work_order_status,
    o.shipping_status,
    count(i.id), coalesce(sum(i.quantity * i.unit_price), 0)
  from public.customer_portal_accounts a
  join public.customer_orders o on o.customer_id = a.customer_id
  left join public.customer_order_items i on i.customer_order_id = o.id
  where a.user_id = auth.uid() and not a.disabled
  group by o.id, o.doc_no, o.status, o.memo, o.created_at, o.shipping_status
  order by o.created_at desc;
$$;

-- 공정 체크리스트: 품목마다 생산지시가 다를 수 있으므로 어느 품목의
-- 공정인지(product_name)까지 같이 돌려준다 — 화면에서 품목이 여럿이면
-- 품목명으로 구분해 보여줄 수 있게. 반환 컬럼 자체가 바뀌어서(기존
-- process_name/sort_order/status 3개 -> item_id/product_name 추가된 5개)
-- CREATE OR REPLACE만으로는 안 되고 먼저 DROP해야 한다(Postgres는 OUT
-- 파라미터로 정의된 행 타입이 다르면 교체를 거부한다).
drop function if exists public.portal_get_order_process_steps(uuid);
create or replace function public.portal_get_order_process_steps(p_order_id uuid)
returns table (item_id uuid, product_name text, process_name text, sort_order int, status text)
language sql
security definer set search_path = public
stable
as $$
  select i.id, p.name, s.process_name, s.sort_order, s.status
  from public.customer_portal_accounts a
  join public.customer_orders o on o.customer_id = a.customer_id
  join public.customer_order_items i on i.customer_order_id = o.id
  join public.products p on p.id = i.product_id
  join public.work_order_process_steps s on s.work_order_id = i.work_order_id
  where a.user_id = auth.uid() and not a.disabled and o.id = p_order_id
  order by i.id, s.sort_order;
$$;
