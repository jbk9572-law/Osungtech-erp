-- 할일에서 불러와 등록한 매출/매입을 나중에 삭제하면 그 할일이 다시 열려야 한다.
--
-- 지금까지는 등록에 성공하면 할일의 "매입 완료/매출 완료" 표시만 찍고 어느 매출/매입에서 썼는지는 남기지 않아,
-- 삭제해도 할일이 닫힌 채로 남았다(다시 불러올 수 없음). 불러오기 연결 기록과 같은 원칙으로 서류 연결을 남기고 삭제 때 되돌린다.
--  1) sales_orders / purchase_orders.source_todo_ids — 이 전표가 불러온 할일들(한 전표에 할일 여러 개 가능).
--  2) mark_todo_side_done에 선택 인자 p_order_id — 완료 표시와 같은 호출에서 연결도 남긴다(같은 회사 전표만).
--  3) 전표를 삭제하면 같은 방향으로 그 할일을 쓰는 다른 전표가 없을 때만 해당 방향 완료 표시를 지우고 다시 연다.
--     매입+매출 유형(당일 매입 후 출고)은 방향별로 따로 계산돼, 매출만 지우면 매출 방향만 다시 열린다.

alter table public.sales_orders add column if not exists source_todo_ids uuid[] not null default '{}';
alter table public.purchase_orders add column if not exists source_todo_ids uuid[] not null default '{}';

drop function if exists public.mark_todo_side_done(uuid, text);

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
  from public.todos where id = p_id and tenant_id = v_tenant;

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

-- 전표 삭제 시 할일 되돌리기. 삭제하는 사람이 할일 주인이 아니어도 되돌려야 하므로 security definer.
create or replace function public.reopen_todos_on_order_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_todo_id uuid;
  v_still_used boolean;
begin
  foreach v_todo_id in array coalesce(old.source_todo_ids, '{}') loop
    if tg_table_name = 'sales_orders' then
      select exists (select 1 from public.sales_orders so where so.id <> old.id and v_todo_id = any(so.source_todo_ids)) into v_still_used;
      if not v_still_used then
        update public.todos set sale_done_at = null, done = false, done_at = null
        where id = v_todo_id and tenant_id = old.tenant_id;
      end if;
    else
      select exists (select 1 from public.purchase_orders po where po.id <> old.id and v_todo_id = any(po.source_todo_ids)) into v_still_used;
      if not v_still_used then
        update public.todos set purchase_done_at = null, done = false, done_at = null
        where id = v_todo_id and tenant_id = old.tenant_id;
      end if;
    end if;
  end loop;
  return old;
end;
$$;

drop trigger if exists reopen_todos_on_sale_delete on public.sales_orders;
create trigger reopen_todos_on_sale_delete
  after delete on public.sales_orders
  for each row execute function public.reopen_todos_on_order_delete();

drop trigger if exists reopen_todos_on_purchase_delete on public.purchase_orders;
create trigger reopen_todos_on_purchase_delete
  after delete on public.purchase_orders
  for each row execute function public.reopen_todos_on_order_delete();
