-- 포털 "주문내역"/"배정된 공정" 목록 화면을 내부 매출관리/매입관리
-- 화면과 같은 조회기간 프리셋+F5/F2 툴바+그리드 아래 상세패널 구성으로
-- 바꾸면서, 목록에 있는 모든 건의 품목/공정 내역을 상세페이지로
-- 넘어가지 않고 그 자리에서 펼쳐 보여줘야 한다. 기존
-- portal_get_order_items/subcontractor_get_work_order_steps는 건 하나
-- (p_order_id/p_work_order_id)만 받으므로, 목록 화면에서 건마다 따로
-- 호출하면 N+1이 된다 — 내부 매출관리가 sales_order_items를 한 번에
-- 조인해서 가져오는 것과 같은 방식으로, 포털 쪽도 "내 건 전체"를
-- 한 번에 돌려주는 목록용 함수를 추가한다(기존 단건 조회 함수는
-- 상세페이지에서 계속 그대로 쓴다 — 건드리지 않음).

create or replace function public.portal_list_order_items()
returns table (
  order_id uuid, product_id uuid, name text, spec text, unit text,
  quantity numeric, unit_price numeric
)
language sql
security definer set search_path = public
stable
as $$
  select o.id, p.id, p.name, p.spec, p.unit, i.quantity, i.unit_price
  from public.customer_portal_accounts a
  join public.customer_orders o on o.customer_id = a.customer_id
  join public.customer_order_items i on i.customer_order_id = o.id
  join public.products p on p.id = i.product_id
  where a.user_id = auth.uid() and not a.disabled;
$$;

revoke all on function public.portal_list_order_items() from public;
grant execute on function public.portal_list_order_items() to authenticated;

-- subcontractor_get_work_order_steps(p_work_order_id)와 같은 조회 조건을
-- 일감(work_order) 하나로 좁히지 않고 "이 업체에 배정된 공정이 하나라도
-- 있는 모든 생산지시"로 넓힌 버전 — 반환 컬럼 앞에 work_order_id만
-- 추가됐다.
create or replace function public.subcontractor_list_all_work_order_steps()
returns table (
  work_order_id uuid, id uuid, process_name text, sort_order int, status text,
  assignee_kind text, subcontractor_name text,
  started_at timestamptz, completed_at timestamptz, shipped_at timestamptz,
  received_at timestamptz, defect_hold boolean, defect_quantity numeric,
  returned_quantity numeric,
  is_mine boolean
)
language sql
security definer set search_path = public
stable
as $$
  select s.work_order_id, s.id, s.process_name, s.sort_order, s.status,
         s.assignee_kind, sc.name,
         s.started_at, s.completed_at, s.shipped_at,
         s.received_at, s.defect_hold, s.defect_quantity,
         s.returned_quantity,
         (s.assignee_kind = 'subcontractor' and s.subcontractor_id = a.subcontractor_id)
  from public.customer_portal_accounts a
  join public.work_order_process_steps s
    on s.work_order_id in (
      select distinct s2.work_order_id
      from public.work_order_process_steps s2
      where s2.assignee_kind = 'subcontractor' and s2.subcontractor_id = a.subcontractor_id
    )
  left join public.subcontractors sc on sc.id = s.subcontractor_id
  where a.user_id = auth.uid() and not a.disabled and a.kind = 'subcontractor'
  order by s.work_order_id, s.sort_order;
$$;

revoke all on function public.subcontractor_list_all_work_order_steps() from public;
grant execute on function public.subcontractor_list_all_work_order_steps() to authenticated;
