-- 할일 완료 함수 점검(동시 접속·모의침투 관점).
--
--  1) toggle_todo_done 은 권한을 우회하는(security definer) 함수인데 "내 회사 할일인지" 확인이 없었다 →
--     할일 id 만 알면 다른 회사 할일의 완료를 뒤집을 수 있었다. 내 회사 할일만 찾도록 한다.
--  2) mark_todo_side_done: '매입+매출 둘 다' 할일은 매입 쪽과 매출 쪽이 따로 완료 표시를 한다.
--     두 사람이 거의 동시에 각자 쪽을 완료하면 둘 다 "상대 쪽은 아직 비어 있음"을 읽고 두 칸을 통째로 덮어써서
--     한쪽 완료 표시가 사라지고 할일이 영영 '완료'가 안 되는(잃어버린 갱신) 문제가 있었다.
--     → 할일 행을 for update 로 잠가 한 번에 한 명씩 처리하고, 잠근 뒤의 최신 값을 읽는다.
-- 함수 모양은 그대로(같은 시그니처).

create or replace function public.toggle_todo_done(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_done boolean;
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;

  select done into v_done from public.todos
  where id = p_id and tenant_id = public.current_tenant_id()
  for update;
  if v_done is null then
    raise exception '할 일을 찾을 수 없습니다.';
  end if;

  update public.todos
  set done = not v_done,
      done_at = case when not v_done then now() else null end
  where id = p_id;
end;
$$;
revoke all on function public.toggle_todo_done(uuid) from public;
grant execute on function public.toggle_todo_done(uuid) to authenticated;

create or replace function public.mark_todo_side_done(p_id uuid, p_side text, p_order_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_tenant uuid := public.current_tenant_id();
  v_todo_type text;
  v_purchase_done_at timestamptz;
  v_sale_done_at timestamptz;
  v_done boolean;
  v_now timestamptz := now();
  v_complete boolean;
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;
  if p_side not in ('purchase', 'sale') then
    raise exception '잘못된 요청입니다.';
  end if;

  select todo_type, purchase_done_at, sale_done_at, done
    into v_todo_type, v_purchase_done_at, v_sale_done_at, v_done
  from public.todos where id = p_id and tenant_id = v_tenant
  for update;

  if not found then
    return;
  end if;

  -- 연결 기록: 같은 회사의 전표에만 남긴다(이미 완료된 할일이어도 연결은 남겨 삭제 때 되돌릴 수 있게 한다).
  if p_order_id is not null then
    if p_side = 'sale' then
      update public.sales_orders
      set source_todo_ids = array_append(source_todo_ids, p_id)
      where id = p_order_id and tenant_id = v_tenant and not (p_id = any(source_todo_ids));
    else
      update public.purchase_orders
      set source_todo_ids = array_append(source_todo_ids, p_id)
      where id = p_order_id and tenant_id = v_tenant and not (p_id = any(source_todo_ids));
    end if;
  end if;

  if v_done then
    return;
  end if;

  if p_side = 'purchase' then
    v_purchase_done_at := v_now;
  else
    v_sale_done_at := v_now;
  end if;

  v_complete := case
    when v_todo_type = 'purchase' then v_purchase_done_at is not null
    when v_todo_type = 'sale' then v_sale_done_at is not null
    else v_purchase_done_at is not null and v_sale_done_at is not null
  end;

  update public.todos
  set purchase_done_at = v_purchase_done_at,
      sale_done_at = v_sale_done_at,
      done = case when v_complete then true else done end,
      done_at = case when v_complete then v_now else done_at end
  where id = p_id;
end;
$$;
revoke all on function public.mark_todo_side_done(uuid, text, uuid) from public;
grant execute on function public.mark_todo_side_done(uuid, text, uuid) to authenticated;
