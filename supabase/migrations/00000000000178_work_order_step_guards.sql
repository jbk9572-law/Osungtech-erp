-- 헌법검사 보류 항목 처리 — 생산관리 공정 단계 RPC 2건의 검증 공백을
-- 메운다.
--
-- 1) assign_work_order_process_step(): 이미 입고/진행/완료된 단계도
--    담당자(내부/외주업체)를 그대로 재배정할 수 있었다. 외주 커스터디
--    원장(subcontractor_inventory_transactions)·단가(unit_cost)가 이미
--    옛 담당자 기준으로 쌓인 뒤에 담당자만 바꿔버리면 그 이력이 새
--    담당자 귀속으로 뒤틀린다 — 재료가 아직 어느 쪽에도 투입되지 않은
--    'pending' 상태일 때만 재배정을 허용한다.
-- 2) return_work_order_process_step_quantity(): 반품 수량을
--    work_orders.quantity(지시 전체 수량) 하나만 기준으로 막고 있어서,
--    한 생산지시에 공정 단계가 여러 개면(예: 가공→포장) 각 단계가
--    독립적으로 지시 수량만큼씩 반품 처리될 수 있었다(실제로는 같은
--    LOT의 같은 물량이 단계를 거쳐가므로 전체 반품 합계가 지시 수량을
--    넘을 수 없어야 한다). 이번 단계 반품 뒤의 "이 생산지시 전체 단계
--    반품 합계"를 기준으로 막도록 좁힌다.

create or replace function public.assign_work_order_process_step(p_id uuid, p_subcontractor_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_default_cost numeric;
  v_status text;
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;

  select status into v_status
  from public.work_order_process_steps
  where id = p_id and tenant_id = public.current_tenant_id();

  if not found then
    raise exception '공정 단계를 찾을 수 없습니다.';
  end if;
  if v_status <> 'pending' then
    raise exception '이미 진행 중이거나 완료된 공정은 담당자를 바꿀 수 없습니다. 자재투입/입고 전(대기 상태)에만 재배정할 수 있습니다.';
  end if;

  if p_subcontractor_id is null then
    update public.work_order_process_steps
    set assignee_kind = 'internal', subcontractor_id = null
    where id = p_id and tenant_id = public.current_tenant_id();
  else
    select default_unit_cost into v_default_cost
    from public.subcontractors
    where id = p_subcontractor_id and tenant_id = public.current_tenant_id();

    if not found then
      raise exception '업체를 찾을 수 없습니다.';
    end if;

    update public.work_order_process_steps
    set assignee_kind = 'subcontractor',
        subcontractor_id = p_subcontractor_id,
        unit_cost = coalesce(unit_cost, v_default_cost)
    where id = p_id and tenant_id = public.current_tenant_id();
  end if;

  if not found then
    raise exception '공정 단계를 찾을 수 없습니다.';
  end if;
end;
$$;

create or replace function public.return_work_order_process_step_quantity(
  p_step_id uuid,
  p_quantity numeric,
  p_note text default null
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_step record;
  v_wo record;
  v_total_returned numeric;
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception '반품 수량을 입력해주세요.';
  end if;

  select * into v_step
  from public.work_order_process_steps
  where id = p_step_id and tenant_id = public.current_tenant_id();
  if v_step is null then
    raise exception '공정 단계를 찾을 수 없습니다.';
  end if;
  if v_step.status not in ('done', 'shipped') then
    raise exception '완료되거나 출고된 단계만 반품 처리할 수 있습니다.';
  end if;

  select * into v_wo from public.work_orders where id = v_step.work_order_id;

  -- 이 단계만의 반품 누계가 아니라, 같은 생산지시(LOT)의 모든 공정
  -- 단계를 합친 반품 누계로 막는다 — 공정이 여러 개여도 실제로는 같은
  -- 물량이 순서대로 거쳐가므로, 전체 합계가 지시 수량을 넘을 수 없다.
  select coalesce(sum(returned_quantity), 0) into v_total_returned
  from public.work_order_process_steps
  where work_order_id = v_step.work_order_id and tenant_id = public.current_tenant_id();

  if v_total_returned + p_quantity > v_wo.quantity then
    raise exception '반품 수량이 지시 수량(%)을 초과할 수 없습니다(이 생산지시의 다른 공정 반품분 포함 이미 %).', v_wo.quantity, v_total_returned;
  end if;

  insert into public.work_order_step_defects
    (step_id, defect_type, quantity, note, reported_by, reported_by_label, tenant_id, is_demo, resolved_at, resolved_by)
  values
    (p_step_id, 'work', p_quantity, p_note, v_actor, '원청(입고 후 반품)', v_step.tenant_id, v_step.is_demo, now(), v_actor);

  update public.work_order_process_steps
  set returned_quantity = returned_quantity + p_quantity
  where id = p_step_id;

  if v_wo.status = 'completed' then
    insert into public.inventory_transactions (product_id, warehouse_id, type, quantity, reference, created_by)
    values (v_wo.product_id, v_wo.warehouse_id, 'adjustment', -p_quantity, 'process_step_return:' || p_step_id, v_actor);
  end if;
end;
$$;
