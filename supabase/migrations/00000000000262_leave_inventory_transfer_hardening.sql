-- 262: 연차 신청 보강(동시 신청 잠금, 대기 중 일수도 잔여에서 차감, 기간 겹침 거절, NaN/기간 초과 일수 거절),
--      재고 직접 쓰기 정책 제거, 창고 이동 보강.

create or replace function public.submit_leave_request(
  p_start_date date,
  p_end_date date,
  p_days numeric,
  p_reason text,
  p_approver_ids uuid[],
  p_reference_ids uuid[] default '{}',
  p_leave_unit text default 'full'
)
returns uuid
language plpgsql
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_name text;
  v_leave_id uuid;
  v_doc_id uuid;
  v_unit_label text;
  v_year integer := extract(year from p_start_date)::int;
  v_total_days numeric;
  v_used_days numeric;
  v_remaining numeric;
  v_balance_note text;
  v_content text;
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;
  if p_end_date < p_start_date then
    raise exception '종료일이 시작일보다 빠를 수 없습니다.';
  end if;
  if p_days is null or p_days = 'NaN'::numeric or p_days <= 0 or p_days > (p_end_date - p_start_date + 1) then
    raise exception '사용 일수를 올바르게 입력해주세요.';
  end if;
  if p_leave_unit not in ('full', 'half_am', 'half_pm', 'quarter_am', 'quarter_pm') then
    raise exception '잘못된 휴가 단위입니다.';
  end if;
  if p_leave_unit <> 'full' and p_start_date <> p_end_date then
    raise exception '반차/반반차는 하루만 신청할 수 있습니다.';
  end if;
  if p_approver_ids is null or array_length(p_approver_ids, 1) is null then
    raise exception '결재선(승인자)을 1명 이상 지정해주세요.';
  end if;

  -- 같은 사람이 동시에 여러 건을 넣어 잔여를 넘기지 못하게 사용자 행을 잠근다.
  select full_name into v_actor_name from public.profiles where id = v_actor for update;

  if exists (
    select 1 from public.leave_requests
    where user_id = v_actor and status in ('approved', 'pending')
      and start_date <= p_end_date and end_date >= p_start_date
  ) then
    raise exception '이미 신청했거나 승인된 휴가와 기간이 겹칩니다.';
  end if;

  select total_days into v_total_days from public.leave_balances where user_id = v_actor and year = v_year;
  select coalesce(sum(days), 0) into v_used_days
  from public.leave_requests
  where user_id = v_actor and status in ('approved', 'pending')
    and start_date >= make_date(v_year, 1, 1) and start_date <= make_date(v_year, 12, 31);
  v_remaining := coalesce(v_total_days, 0) - v_used_days;

  -- 예전엔 여기서 경고 문구만 결재 본문에 덧붙이고 신청은 그냥 통과시켰다.
  -- 이제는 잔여를 초과하면 신청 자체를 막는다 — 결재권자(관리자)가
  -- grant_extra_leave()로 추가 연차를 사유와 함께 부여한 뒤 다시
  -- 신청해야 한다.
  if v_remaining - p_days < 0 then
    raise exception '잔여 연차(%s일)가 이번 신청(%s일)보다 부족합니다. 관리자에게 추가 연차 부여를 요청한 뒤 다시 신청해주세요.', v_remaining, p_days;
  end if;

  v_balance_note := format(
    '[잔여 연차 안내] %s년 총 %s일 중 %s일 사용, 이번 신청(%s일) 전 잔여 %s일 → 신청 후 %s일',
    v_year, coalesce(v_total_days, 0), v_used_days, p_days, v_remaining, v_remaining - p_days
  );

  v_unit_label := case p_leave_unit
    when 'half_am' then ' (오전반차)'
    when 'half_pm' then ' (오후반차)'
    when 'quarter_am' then ' (오전반반차)'
    when 'quarter_pm' then ' (오후반반차)'
    else ''
  end;

  v_content := v_balance_note || E'\n\n' || coalesce(p_reason, '');

  v_doc_id := public.submit_approval_document(
    coalesce(v_actor_name, '구성원') || '의 연차 신청 (' || p_start_date || ' ~ ' || p_end_date || ', ' || p_days || '일)' || v_unit_label,
    v_content,
    p_approver_ids,
    p_reference_ids
  );

  insert into public.leave_requests (user_id, start_date, end_date, days, reason, approval_document_id, leave_unit)
  values (v_actor, p_start_date, p_end_date, p_days, p_reason, v_doc_id, p_leave_unit)
  returning id into v_leave_id;

  update public.approval_documents set source_type = 'leave_request', source_id = v_leave_id where id = v_doc_id;

  return v_leave_id;
end;
$$;

revoke all on function public.submit_leave_request(date, date, numeric, text, uuid[], uuid[], text) from public;
grant execute on function public.submit_leave_request(date, date, numeric, text, uuid[], uuid[], text) to authenticated;

-- 재고 수량(inventory)은 입출고 원장(inventory_transactions)을 통해 definer 트리거/함수로만 바뀐다.
-- 정책을 지우면 SELECT ... FOR UPDATE(행 잠금)도 막혀 정상 흐름이 깨지므로, 정책은 두고
-- 직원(authenticated/anon)이 REST로 직접 수량을 바꾸거나 행을 넣고 지우는 것만 트리거로 막는다.
create or replace function public.guard_inventory_direct_write()
returns trigger
language plpgsql
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return coalesce(new, old);
  end if;
  if tg_op = 'UPDATE' and new.quantity is not distinct from old.quantity
     and new.product_id is not distinct from old.product_id
     and new.warehouse_id is not distinct from old.warehouse_id then
    return new;
  end if;
  raise exception '재고 수량은 직접 고칠 수 없습니다. 입출고/재고조정 기능을 이용해주세요.';
end;
$$;
drop trigger if exists inventory_guard_direct_write on public.inventory;
create trigger inventory_guard_direct_write
  before insert or update or delete on public.inventory
  for each row execute function public.guard_inventory_direct_write();

-- 창고 이동: 두 창고 모두 우리 회사 것이어야 하고(RLS로 보이는 창고만), 삭제는 전표 행을 잠근 뒤 처리한다.
create or replace function public.create_stock_transfer_with_items(
  p_from_warehouse_id uuid,
  p_to_warehouse_id uuid,
  p_transfer_date date,
  p_memo text,
  p_items jsonb
)
returns uuid
language plpgsql
as $$
declare
  v_actor uuid := auth.uid();
  v_transfer_id uuid;
  v_item jsonb;
  v_product_id uuid;
  v_quantity numeric;
  v_available numeric;
  v_product_name text;
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;
  if p_from_warehouse_id = p_to_warehouse_id then
    raise exception '출발 창고와 도착 창고가 같을 수 없습니다.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception '이동할 품목을 1개 이상 입력해주세요.';
  end if;
  if (select count(*) from public.warehouses where id in (p_from_warehouse_id, p_to_warehouse_id)) <> 2 then
    raise exception '창고를 찾을 수 없습니다.';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_product_id := (v_item->>'productId')::uuid;
    v_quantity := (v_item->>'quantity')::numeric;
    if v_quantity is null or v_quantity = 'NaN'::numeric or v_quantity <= 0 then
      raise exception '이동 수량은 0보다 커야 합니다.';
    end if;
  end loop;

  -- 같은 품목이 여러 줄이면 합산해서 출발 창고 재고와 비교한다.
  for v_product_id, v_quantity in
    select (item->>'productId')::uuid, sum((item->>'quantity')::numeric)
    from jsonb_array_elements(p_items) as item
    group by 1
  loop
    select i.quantity, p.name into v_available, v_product_name
    from public.inventory i
    join public.products p on p.id = v_product_id
    where i.product_id = v_product_id and i.warehouse_id = p_from_warehouse_id
    for update of i;

    if v_available is null then
      select name into v_product_name from public.products where id = v_product_id;
      raise exception '"%"의 출발 창고 재고가 0이라 이동할 수 없습니다.', coalesce(v_product_name, '품목');
    end if;
    if v_available < v_quantity then
      raise exception '"%"의 출발 창고 재고(%)가 이동 수량(%)보다 적습니다.', v_product_name, v_available, v_quantity;
    end if;
  end loop;

  insert into public.stock_transfers (from_warehouse_id, to_warehouse_id, transfer_date, memo, created_by)
  values (p_from_warehouse_id, p_to_warehouse_id, p_transfer_date, p_memo, v_actor)
  returning id into v_transfer_id;

  insert into public.stock_transfer_items (stock_transfer_id, product_id, quantity, remark)
  select v_transfer_id, (item->>'productId')::uuid, (item->>'quantity')::numeric, nullif(item->>'remark', '')
  from jsonb_array_elements(p_items) as item;

  insert into public.inventory_transactions (product_id, warehouse_id, type, quantity, reference, note, created_by)
  select (item->>'productId')::uuid, p_from_warehouse_id, 'out', (item->>'quantity')::numeric,
         'stock_transfer:' || v_transfer_id, '창고 이동(출발)', v_actor
  from jsonb_array_elements(p_items) as item;

  insert into public.inventory_transactions (product_id, warehouse_id, type, quantity, reference, note, created_by)
  select (item->>'productId')::uuid, p_to_warehouse_id, 'in', (item->>'quantity')::numeric,
         'stock_transfer:' || v_transfer_id, '창고 이동(도착)', v_actor
  from jsonb_array_elements(p_items) as item;

  return v_transfer_id;
end;
$$;

create or replace function public.delete_stock_transfer(p_id uuid)
returns void
language plpgsql
as $$
declare
  v_actor uuid := auth.uid();
  v_owner uuid;
  v_from_warehouse_id uuid;
  v_to_warehouse_id uuid;
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;

  select created_by, from_warehouse_id, to_warehouse_id
    into v_owner, v_from_warehouse_id, v_to_warehouse_id
  from public.stock_transfers where id = p_id
  for update;

  if v_from_warehouse_id is null then
    raise exception '이동 전표를 찾을 수 없습니다.';
  end if;
  if v_owner is distinct from v_actor and not public.is_admin() then
    raise exception '본인이 등록한 이동 전표만 삭제할 수 있습니다.';
  end if;

  insert into public.inventory_transactions (product_id, warehouse_id, type, quantity, reference, note, created_by)
  select product_id, v_from_warehouse_id, 'adjustment', quantity, 'stock_transfer_reversal:' || p_id, '창고 이동 취소(복원)', v_actor
  from public.stock_transfer_items where stock_transfer_id = p_id;

  insert into public.inventory_transactions (product_id, warehouse_id, type, quantity, reference, note, created_by)
  select product_id, v_to_warehouse_id, 'adjustment', -quantity, 'stock_transfer_reversal:' || p_id, '창고 이동 취소(회수)', v_actor
  from public.stock_transfer_items where stock_transfer_id = p_id;

  delete from public.stock_transfers where id = p_id;
end;
$$;

revoke all on function public.create_stock_transfer_with_items(uuid, uuid, date, text, jsonb) from public;
grant execute on function public.create_stock_transfer_with_items(uuid, uuid, date, text, jsonb) to authenticated;
revoke all on function public.delete_stock_transfer(uuid) from public;
grant execute on function public.delete_stock_transfer(uuid) to authenticated;
