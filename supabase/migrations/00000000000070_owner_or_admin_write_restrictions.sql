-- 매출/매입/할일/공지사항을 "로그인만 하면 누구나 수정·삭제 가능"에서
-- "작성자 본인 또는 관리자만 수정·삭제 가능"으로 좁힌다. 조회(select)와
-- 신규 등록(insert)은 지금처럼 전 직원에게 열어둔다 — 이번 변경은 오직
-- "남이 이미 등록한 걸 건드리는" 경우만 막는다.
--
-- 지급결의서(payment_requests)는 부서+카드종류+월 단위로 여러 직원이
-- 같은 문서에 지출을 계속 이어붙이는 공유 문서 구조라(quickAddPaymentRequestItem
-- 참고) 이번 마이그레이션에서는 건드리지 않는다 — 별도로 다룬다.

-- ── 매출/매입 ────────────────────────────────────────────────
-- update_sale_with_items/delete_sale_with_items/update_purchase_with_items/
-- delete_purchase_with_items는 security invoker라서 RLS가 실제 방어선이지만,
-- RLS만으로 막으면 "허용 안 된 행은 조용히 0건 갱신"으로 끝나버려서 —
-- 예를 들어 delete_sale_with_items는 재고를 먼저 되돌리는 insert부터 실행한
-- 뒤에 삭제를 시도하므로, 삭제만 조용히 막히면 "재고는 되돌아갔는데 거래는
-- 안 지워진" 불일치가 생긴다. 그래서 함수 맨 앞에서 명시적으로 소유자/관리자
-- 여부를 확인해서, 아니면 통째로 롤백되게 예외를 던진다. RLS 쪽도 같은
-- 조건으로 맞춰서 이 RPC를 우회해 테이블을 직접 두드리는 경우까지 막는다
-- (defense in depth) — 매개변수 시그니처는 바꾸지 않는다.

create or replace function public.update_sale_with_items(
  p_id uuid,
  p_customer_id uuid,
  p_warehouse_id uuid,
  p_order_date date,
  p_memo text,
  p_updated_by uuid,
  p_items jsonb,
  p_payment_method text default null,
  p_delivery_method text default null,
  p_doc_no bigint default null
)
returns uuid
language plpgsql
as $$
declare
  v_old_warehouse_id uuid;
  v_owner uuid;
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;

  select warehouse_id, created_by into v_old_warehouse_id, v_owner from public.sales_orders where id = p_id;
  if v_old_warehouse_id is null then
    raise exception '매출 거래를 찾을 수 없습니다.';
  end if;
  if v_owner is distinct from v_actor and not public.is_admin() then
    raise exception '본인이 등록한 매출만 수정할 수 있습니다.';
  end if;

  update public.sales_orders
  set customer_id = p_customer_id,
      warehouse_id = p_warehouse_id,
      order_date = p_order_date,
      memo = p_memo,
      payment_method = p_payment_method,
      delivery_method = p_delivery_method,
      doc_no = coalesce(p_doc_no, doc_no)
  where id = p_id;

  insert into public.inventory_transactions (product_id, warehouse_id, type, quantity, reference, created_by)
  select product_id, v_old_warehouse_id, 'adjustment', quantity, 'sales_order_reversal:' || p_id, v_actor
  from public.sales_order_items
  where sales_order_id = p_id;

  delete from public.sales_order_items where sales_order_id = p_id;

  if jsonb_array_length(p_items) > 0 then
    insert into public.sales_order_items (sales_order_id, product_id, spec, quantity, unit_price, remark, lot_number)
    select
      p_id,
      (item->>'productId')::uuid,
      nullif(item->>'spec', ''),
      (item->>'quantity')::numeric,
      (item->>'unitPrice')::numeric,
      nullif(item->>'remark', ''),
      nullif(item->>'lotNumber', '')
    from jsonb_array_elements(p_items) as item;

    insert into public.inventory_transactions
      (product_id, warehouse_id, type, quantity, reference, sales_order_id, created_by)
    select
      (item->>'productId')::uuid,
      p_warehouse_id,
      'out',
      (item->>'quantity')::numeric,
      'sales_order:' || p_id,
      p_id,
      v_actor
    from jsonb_array_elements(p_items) as item;
  end if;

  return p_id;
end;
$$;

create or replace function public.delete_sale_with_items(
  p_id uuid,
  p_deleted_by uuid
)
returns void
language plpgsql
as $$
declare
  v_warehouse_id uuid;
  v_owner uuid;
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;

  select warehouse_id, created_by into v_warehouse_id, v_owner from public.sales_orders where id = p_id;
  if v_warehouse_id is null then
    raise exception '매출 거래를 찾을 수 없습니다.';
  end if;
  if v_owner is distinct from v_actor and not public.is_admin() then
    raise exception '본인이 등록한 매출만 삭제할 수 있습니다.';
  end if;

  insert into public.inventory_transactions (product_id, warehouse_id, type, quantity, reference, created_by)
  select product_id, v_warehouse_id, 'adjustment', quantity, 'sales_order_reversal:' || p_id, v_actor
  from public.sales_order_items
  where sales_order_id = p_id;

  delete from public.sales_orders where id = p_id;
end;
$$;

create or replace function public.update_purchase_with_items(
  p_id uuid,
  p_supplier_id uuid,
  p_warehouse_id uuid,
  p_purchase_date date,
  p_memo text,
  p_updated_by uuid,
  p_items jsonb,
  p_payment_method text default null,
  p_delivery_method text default null,
  p_doc_no bigint default null
)
returns uuid
language plpgsql
as $$
declare
  v_old_warehouse_id uuid;
  v_owner uuid;
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;

  select warehouse_id, created_by into v_old_warehouse_id, v_owner from public.purchase_orders where id = p_id;
  if v_old_warehouse_id is null then
    raise exception '매입 거래를 찾을 수 없습니다.';
  end if;
  if v_owner is distinct from v_actor and not public.is_admin() then
    raise exception '본인이 등록한 매입만 수정할 수 있습니다.';
  end if;

  update public.purchase_orders
  set supplier_id = p_supplier_id,
      warehouse_id = p_warehouse_id,
      purchase_date = p_purchase_date,
      memo = p_memo,
      payment_method = p_payment_method,
      delivery_method = p_delivery_method,
      doc_no = coalesce(p_doc_no, doc_no)
  where id = p_id;

  insert into public.inventory_transactions (product_id, warehouse_id, type, quantity, reference, created_by)
  select product_id, v_old_warehouse_id, 'adjustment', -quantity, 'purchase_order_reversal:' || p_id, v_actor
  from public.purchase_order_items
  where purchase_order_id = p_id;

  delete from public.purchase_order_items where purchase_order_id = p_id;

  if jsonb_array_length(p_items) > 0 then
    insert into public.purchase_order_items (purchase_order_id, product_id, spec, quantity, unit_cost, remark, lot_number)
    select
      p_id,
      (item->>'productId')::uuid,
      nullif(item->>'spec', ''),
      (item->>'quantity')::numeric,
      (item->>'unitCost')::numeric,
      nullif(item->>'remark', ''),
      nullif(item->>'lotNumber', '')
    from jsonb_array_elements(p_items) as item;

    insert into public.inventory_transactions
      (product_id, warehouse_id, type, quantity, reference, purchase_order_id, created_by)
    select
      (item->>'productId')::uuid,
      p_warehouse_id,
      'in',
      (item->>'quantity')::numeric,
      'purchase_order:' || p_id,
      p_id,
      v_actor
    from jsonb_array_elements(p_items) as item;
  end if;

  return p_id;
end;
$$;

create or replace function public.delete_purchase_with_items(
  p_id uuid,
  p_deleted_by uuid
)
returns void
language plpgsql
as $$
declare
  v_warehouse_id uuid;
  v_owner uuid;
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;

  select warehouse_id, created_by into v_warehouse_id, v_owner from public.purchase_orders where id = p_id;
  if v_warehouse_id is null then
    raise exception '매입 거래를 찾을 수 없습니다.';
  end if;
  if v_owner is distinct from v_actor and not public.is_admin() then
    raise exception '본인이 등록한 매입만 삭제할 수 있습니다.';
  end if;

  insert into public.inventory_transactions (product_id, warehouse_id, type, quantity, reference, created_by)
  select product_id, v_warehouse_id, 'adjustment', -quantity, 'purchase_order_reversal:' || p_id, v_actor
  from public.purchase_order_items
  where purchase_order_id = p_id;

  delete from public.purchase_orders where id = p_id;
end;
$$;

-- RLS도 같은 조건으로 맞춘다(defense in depth) — 위 4개 RPC를 우회해서
-- 테이블을 직접 두드리는 경우, 그리고 paper-calc-sync.ts(모조지 계산 결과를
-- 주문 품목에 반영)처럼 RPC 없이 sales_order_items/purchase_order_items를
-- 직접 insert/update/delete하는 경로까지 같은 기준으로 막기 위해 품목
-- 테이블도 "그 주문의 소유자 또는 관리자"로 좁힌다.
drop policy if exists "sales_orders_update_authenticated" on public.sales_orders;
create policy "sales_orders_update_owner_or_admin" on public.sales_orders
  for update using (created_by = auth.uid() or public.is_admin());

drop policy if exists "sales_orders_delete_authenticated" on public.sales_orders;
create policy "sales_orders_delete_owner_or_admin" on public.sales_orders
  for delete using (created_by = auth.uid() or public.is_admin());

drop policy if exists "purchase_orders_update_authenticated" on public.purchase_orders;
create policy "purchase_orders_update_owner_or_admin" on public.purchase_orders
  for update using (created_by = auth.uid() or public.is_admin());

drop policy if exists "purchase_orders_delete_authenticated" on public.purchase_orders;
create policy "purchase_orders_delete_owner_or_admin" on public.purchase_orders
  for delete using (created_by = auth.uid() or public.is_admin());

drop policy if exists "sales_order_items_insert_authenticated" on public.sales_order_items;
create policy "sales_order_items_insert_owner_or_admin" on public.sales_order_items
  for insert with check (
    exists (
      select 1 from public.sales_orders so
      where so.id = sales_order_items.sales_order_id
        and (so.created_by = auth.uid() or public.is_admin())
    )
  );

drop policy if exists "sales_order_items_update_authenticated" on public.sales_order_items;
create policy "sales_order_items_update_owner_or_admin" on public.sales_order_items
  for update using (
    exists (
      select 1 from public.sales_orders so
      where so.id = sales_order_items.sales_order_id
        and (so.created_by = auth.uid() or public.is_admin())
    )
  );

drop policy if exists "sales_order_items_delete_authenticated" on public.sales_order_items;
create policy "sales_order_items_delete_owner_or_admin" on public.sales_order_items
  for delete using (
    exists (
      select 1 from public.sales_orders so
      where so.id = sales_order_items.sales_order_id
        and (so.created_by = auth.uid() or public.is_admin())
    )
  );

drop policy if exists "purchase_order_items_insert_authenticated" on public.purchase_order_items;
create policy "purchase_order_items_insert_owner_or_admin" on public.purchase_order_items
  for insert with check (
    exists (
      select 1 from public.purchase_orders po
      where po.id = purchase_order_items.purchase_order_id
        and (po.created_by = auth.uid() or public.is_admin())
    )
  );

drop policy if exists "purchase_order_items_update_authenticated" on public.purchase_order_items;
create policy "purchase_order_items_update_owner_or_admin" on public.purchase_order_items
  for update using (
    exists (
      select 1 from public.purchase_orders po
      where po.id = purchase_order_items.purchase_order_id
        and (po.created_by = auth.uid() or public.is_admin())
    )
  );

drop policy if exists "purchase_order_items_delete_authenticated" on public.purchase_order_items;
create policy "purchase_order_items_delete_owner_or_admin" on public.purchase_order_items
  for delete using (
    exists (
      select 1 from public.purchase_orders po
      where po.id = purchase_order_items.purchase_order_id
        and (po.created_by = auth.uid() or public.is_admin())
    )
  );

-- ── 할일관리 ──────────────────────────────────────────────────
-- "완료 체크"는 할일을 만든 사람이 아니라 실제로 그 일을 처리한 사람이
-- 눌러야 하는 경우가 대부분이라(예: 사무실 직원이 만든 출고 준비 할일을
-- 창고 담당자가 완료 처리), 전체 수정/삭제는 작성자·관리자로 좁히되
-- "완료/미완료 토글"만은 별도 함수로 열어둔다.
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

  select done into v_done from public.todos where id = p_id;
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

drop policy if exists "todos_update_authenticated" on public.todos;
create policy "todos_update_owner_or_admin" on public.todos
  for update using (created_by = auth.uid() or public.is_admin());

drop policy if exists "todos_delete_authenticated" on public.todos;
create policy "todos_delete_owner_or_admin" on public.todos
  for delete using (created_by = auth.uid() or public.is_admin());

-- ── 공지사항 ──────────────────────────────────────────────────
drop policy if exists "announcements_update_authenticated" on public.announcements;
create policy "announcements_update_owner_or_admin" on public.announcements
  for update using (created_by = auth.uid() or public.is_admin());

drop policy if exists "announcements_delete_authenticated" on public.announcements;
create policy "announcements_delete_owner_or_admin" on public.announcements
  for delete using (created_by = auth.uid() or public.is_admin());
