-- 불량 발생 시 책임소재를 명확히 가릴 수 있어야 한다는 요구로, 업체
-- 포털에 LOT 단위 이력(품목명/규격/제조일/LOT번호/이전 단계 담당자)을
-- 보여준다. 이 ERP는 생산지시 하나 = LOT 하나로 다루므로(이미 doc_no가
-- 생산지시마다 유일하게 채번됨) 별도 LOT 테이블 없이 work_orders.doc_no를
-- LOT번호로, order_date를 제조(착수)일로 그대로 쓴다 — "이전 작업자"는
-- 같은 생산지시의 공정 체크리스트에서 바로 앞 sort_order 단계의
-- 담당자이므로(이미 subcontractor_get_work_order_steps가 전체 단계를
-- 순서대로 내려줌) 프런트에서 계산하고, 여기서는 품목 규격(product_spec)만
-- 추가로 내려준다. 반환 컬럼이 늘어나므로 CREATE OR REPLACE 전에
-- DROP이 필요하다(migration 164와 같은 이유).

drop function if exists public.subcontractor_list_work_orders();
create or replace function public.subcontractor_list_work_orders()
returns table (
  id uuid, doc_no bigint, product_name text, product_spec text, quantity numeric, status text,
  order_date date, created_at timestamptz
)
language sql
security definer set search_path = public
stable
as $$
  select distinct wo.id, wo.doc_no, p.name, p.spec, wo.quantity, wo.status, wo.order_date, wo.created_at
  from public.customer_portal_accounts a
  join public.work_order_process_steps s
    on s.assignee_kind = 'subcontractor' and s.subcontractor_id = a.subcontractor_id
  join public.work_orders wo on wo.id = s.work_order_id
  join public.products p on p.id = wo.product_id
  where a.user_id = auth.uid() and not a.disabled and a.kind = 'subcontractor'
  order by wo.created_at desc;
$$;

revoke all on function public.subcontractor_list_work_orders() from public;
grant execute on function public.subcontractor_list_work_orders() to authenticated;

drop function if exists public.subcontractor_get_work_order(uuid);
create or replace function public.subcontractor_get_work_order(p_work_order_id uuid)
returns table (
  id uuid, doc_no bigint, product_name text, product_spec text, quantity numeric, status text,
  order_date date, memo text
)
language sql
security definer set search_path = public
stable
as $$
  select wo.id, wo.doc_no, p.name, p.spec, wo.quantity, wo.status, wo.order_date, wo.memo
  from public.customer_portal_accounts a
  join public.work_orders wo on wo.id = p_work_order_id
  join public.products p on p.id = wo.product_id
  where a.user_id = auth.uid() and not a.disabled and a.kind = 'subcontractor'
    and exists (
      select 1 from public.work_order_process_steps s2
      where s2.work_order_id = wo.id
        and s2.assignee_kind = 'subcontractor'
        and s2.subcontractor_id = a.subcontractor_id
    );
$$;

revoke all on function public.subcontractor_get_work_order(uuid) from public;
grant execute on function public.subcontractor_get_work_order(uuid) to authenticated;
