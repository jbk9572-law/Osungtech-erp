-- BOM·생산지시 점검(실 Postgres 시험으로 재현한 구멍 6개) 수정.
--
--  1) 자재투입·생산완료·삭제를 두 사람이(또는 더블클릭으로) 동시에 누르면 둘 다 "대기/투입완료" 상태를 읽고 통과해서
--     자재가 두 번 차감되거나(20회 중 18회), 완제품이 두 번 입고되거나(7회), 삭제 때 재고가 두 번 복구됐다(17회, 완제품이 -10으로).
--     → 생산지시 행을 for update 로 잠가 한 번에 한 명만 처리한다(매출/매입 247 과 같은 방식).
--  2) 삭제 때 자재를 "지금의 BOM" 기준으로 되돌렸다. 자재투입 뒤 BOM 수량을 바꾸면 엉뚱한 수량이 복구되고(10개 생산, 2→5로 변경 후 삭제 시
--     재고 +30 어긋남), 구성품 줄을 지웠으면 그 자재는 복구되지 않았다(재고 영구 손실).
--     → 재고 원장(inventory_transactions)에 이 생산지시로 실제 기록된 출고/입고를 그대로 되돌린다(BOM 이 그 뒤에 바뀌어도 정확).
--  3) 외주업체에 자재를 내보낸 생산지시를 삭제하면 우리 재고는 복구되는데 업체 보유재고 기록은 남아, 같은 자재가 두 곳에 잡혔다.
--     → 업체에 자재가 남아 있으면(반납·소비되지 않은 수량) 삭제를 막고 안내한다.
--  4) BOM 에 "다른 회사 품목"을 구성품/모품목으로 넣을 수 있었다(RLS 가 bom 행의 회사만 보고 품목의 회사는 안 봄) →
--     남의 품목이 내 BOM 에 걸려(구성품은 삭제 제한 FK) 그 회사가 품목을 지우지 못하게 방해할 수 있었다. → 같은 회사 품목만 허용(트리거).
--  5) 외주업체 보유재고를 줄이는 '소비' 기록이 항상 실패했다(보유 20 → 소비 20 이 "보유수량은 0 이상" 제약 오류).
--     원인: 보유재고 갱신이 "일단 insert(-20) 해보고 충돌하면 update"인데, Postgres 는 충돌 검사 전에 제안된 행(-20)의 CHECK 제약부터 검사해서 음수 소비가 전부 걸렸다.
--     외주 첫 공정 완료 때 자동으로 하는 투입 소비(consume_subcontractor_material_for_step)가 같은 경로라 외주 공정 완료가 막힐 수 있었다.
--     → 줄이는 경우는 먼저 기존 행을 update 하고, 기존 행이 없을 때만 insert 한다(없는 재고를 소비하면 기존처럼 제약 오류).
-- 함수 모양(인자·반환)은 그대로 둔다.

-- ── 4) BOM 회사 검증 ─────────────────────────────────────
create or replace function public.guard_bom_item_same_tenant()
returns trigger
language plpgsql
as $$
begin
  -- 사용자(authenticated) 권한으로 실행되면 products 조회에도 RLS 가 걸려 "내 회사 품목"만 보인다. 서비스 롤은 tenant_id 를 직접 비교한다.
  if not exists (select 1 from public.products p where p.id = new.parent_product_id and p.tenant_id = new.tenant_id) then
    raise exception 'BOM 의 완제품이 우리 회사 품목이 아닙니다.';
  end if;
  if not exists (select 1 from public.products p where p.id = new.component_product_id and p.tenant_id = new.tenant_id) then
    raise exception 'BOM 의 구성품이 우리 회사 품목이 아닙니다.';
  end if;
  return new;
end;
$$;

drop trigger if exists bom_items_guard_same_tenant on public.bom_items;
create trigger bom_items_guard_same_tenant
  before insert or update on public.bom_items
  for each row execute function public.guard_bom_item_same_tenant();

-- ── 1) 자재투입 ──────────────────────────────────────────
create or replace function public.issue_work_order_materials(p_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_status text;
  v_product_id uuid;
  v_warehouse_id uuid;
  v_quantity numeric;
  v_tenant_id uuid;
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;

  select status, product_id, warehouse_id, quantity, tenant_id
    into v_status, v_product_id, v_warehouse_id, v_quantity, v_tenant_id
  from public.work_orders where id = p_id
  for update;

  if v_status is null then
    raise exception '생산지시를 찾을 수 없습니다.';
  end if;
  if v_tenant_id <> public.current_tenant_id() then
    raise exception '다른 회사의 생산지시는 처리할 수 없습니다.';
  end if;
  if v_status <> 'pending' then
    raise exception '대기 상태인 생산지시만 자재투입할 수 있습니다(현재: %).', v_status;
  end if;

  insert into public.inventory_transactions (product_id, warehouse_id, type, quantity, reference, created_by)
  select component_product_id, v_warehouse_id, 'out', quantity_per_unit * v_quantity,
         'work_order:' || p_id, v_actor
  from public.bom_items
  where parent_product_id = v_product_id;

  update public.work_orders
  set status = 'material_issued', material_issued_at = now()
  where id = p_id;
end;
$$;
revoke all on function public.issue_work_order_materials(uuid) from public;
grant execute on function public.issue_work_order_materials(uuid) to authenticated;

-- ── 1) 외주 자재투입 ─────────────────────────────────────
create or replace function public.issue_work_order_materials_to_subcontractor(p_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_wo record;
  v_first_step record;
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;

  select * into v_wo from public.work_orders where id = p_id for update;
  if v_wo is null then
    raise exception '생산지시를 찾을 수 없습니다.';
  end if;
  if v_wo.tenant_id <> public.current_tenant_id() then
    raise exception '다른 회사의 생산지시는 처리할 수 없습니다.';
  end if;
  if v_wo.status <> 'pending' then
    raise exception '대기 상태인 생산지시만 자재투입할 수 있습니다(현재: %).', v_wo.status;
  end if;

  select * into v_first_step
  from public.work_order_process_steps
  where work_order_id = p_id
  order by sort_order
  limit 1;

  if v_first_step is null or v_first_step.assignee_kind <> 'subcontractor' then
    raise exception '첫 공정이 외주로 배정된 생산지시에서만 사용할 수 있습니다.';
  end if;

  insert into public.inventory_transactions (product_id, warehouse_id, type, quantity, reference, created_by)
  select component_product_id, v_wo.warehouse_id, 'out', quantity_per_unit * v_wo.quantity,
         'work_order:' || p_id, v_actor
  from public.bom_items
  where parent_product_id = v_wo.product_id;

  insert into public.subcontractor_inventory_transactions
    (subcontractor_id, product_id, type, quantity, work_order_id, reference, created_by, tenant_id, is_demo)
  select v_first_step.subcontractor_id, component_product_id, 'issued', quantity_per_unit * v_wo.quantity,
         p_id, 'work_order:' || p_id, v_actor, v_wo.tenant_id, v_wo.is_demo
  from public.bom_items
  where parent_product_id = v_wo.product_id;

  update public.work_orders
  set status = 'material_issued', material_issued_at = now()
  where id = p_id;
end;
$$;
revoke all on function public.issue_work_order_materials_to_subcontractor(uuid) from public;
grant execute on function public.issue_work_order_materials_to_subcontractor(uuid) to authenticated;

-- ── 1) 생산완료 ──────────────────────────────────────────
create or replace function public.complete_work_order(p_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_status text;
  v_product_id uuid;
  v_warehouse_id uuid;
  v_quantity numeric;
  v_tenant_id uuid;
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;

  select status, product_id, warehouse_id, quantity, tenant_id
    into v_status, v_product_id, v_warehouse_id, v_quantity, v_tenant_id
  from public.work_orders where id = p_id
  for update;

  if v_status is null then
    raise exception '생산지시를 찾을 수 없습니다.';
  end if;
  if v_tenant_id <> public.current_tenant_id() then
    raise exception '다른 회사의 생산지시는 처리할 수 없습니다.';
  end if;
  if v_status <> 'material_issued' then
    raise exception '자재투입이 끝난 생산지시만 생산완료 처리할 수 있습니다(현재: %).', v_status;
  end if;

  insert into public.inventory_transactions (product_id, warehouse_id, type, quantity, reference, created_by)
  values (v_product_id, v_warehouse_id, 'in', v_quantity, 'work_order:' || p_id, v_actor);

  update public.work_orders
  set status = 'completed', completed_at = now()
  where id = p_id;
end;
$$;
revoke all on function public.complete_work_order(uuid) from public;
grant execute on function public.complete_work_order(uuid) to authenticated;

-- ── 1)(2)(3) 삭제 ────────────────────────────────────────
create or replace function public.delete_work_order(p_id uuid)
returns void
language plpgsql
as $$
declare
  v_actor uuid := auth.uid();
  v_owner uuid;
  v_status text;
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;

  select created_by, status
    into v_owner, v_status
  from public.work_orders where id = p_id
  for update;

  if v_owner is null then
    raise exception '생산지시를 찾을 수 없습니다.';
  end if;
  if v_owner <> v_actor and not public.is_admin() then
    raise exception '본인이 등록했거나 관리자인 경우만 삭제할 수 있습니다.';
  end if;

  -- 외주업체에 보낸 자재가 아직 업체에 남아 있으면(소비·정리되지 않은 수량) 삭제하면 같은 자재가 우리 창고와 업체 두 곳에 잡힌다.
  if exists (
    select 1
    from public.subcontractor_inventory_transactions t
    where t.work_order_id = p_id
    group by t.subcontractor_id, t.product_id
    having sum(case when t.type = 'consumed' then -abs(t.quantity) when t.type = 'adjustment' then t.quantity else abs(t.quantity) end) > 0
  ) then
    raise exception '외주업체에 보낸 자재가 아직 업체에 남아 있어 삭제할 수 없습니다. 업체에서 소비 또는 반납 처리를 먼저 해주세요.';
  end if;

  -- 이 생산지시로 재고 원장에 실제로 기록된 것만 정확히 되돌린다(자재투입 뒤 BOM 이 바뀌었어도 영향 없음).
  if v_status in ('material_issued', 'completed') then
    insert into public.inventory_transactions (product_id, warehouse_id, type, quantity, reference, created_by)
    select t.product_id, t.warehouse_id,
           case t.type when 'out' then 'in' else 'out' end,
           t.quantity, 'work_order_delete:' || p_id, v_actor
    from public.inventory_transactions t
    where t.reference = 'work_order:' || p_id
      and t.type in ('in', 'out');
  end if;

  delete from public.work_orders where id = p_id;
end;
$$;
revoke all on function public.delete_work_order(uuid) from public;
grant execute on function public.delete_work_order(uuid) to authenticated;

-- ── 5) 외주 보유재고 갱신 ────────────────────────────────
create or replace function public.apply_subcontractor_inventory_transaction()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  delta numeric;
begin
  delta := case
    when new.type = 'consumed' then -abs(new.quantity)
    when new.type = 'adjustment' then new.quantity
    else abs(new.quantity)
  end;

  update public.subcontractor_inventory
  set quantity = quantity + delta, updated_at = now()
  where subcontractor_id = new.subcontractor_id and product_id = new.product_id;

  if not found then
    -- 기존 행이 없을 때만 새로 만든다. 같은 순간에 둘이 처음 만들면 한쪽이 충돌하므로 그때는 update 로 합친다.
    begin
      insert into public.subcontractor_inventory (subcontractor_id, product_id, quantity, updated_at, tenant_id, is_demo)
      values (new.subcontractor_id, new.product_id, delta, now(), new.tenant_id, new.is_demo);
    exception when unique_violation then
      update public.subcontractor_inventory
      set quantity = quantity + delta, updated_at = now()
      where subcontractor_id = new.subcontractor_id and product_id = new.product_id;
    end;
  end if;

  return new;
end;
$$;
