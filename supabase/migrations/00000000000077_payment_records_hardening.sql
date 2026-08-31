-- 3차 정기 감사에서 발견된 3건을 한 마이그레이션으로 묶어 처리한다:
--
-- 1) customer_payments/supplier_payments(수금/지급 내역)가 migration 70/76이
--    sales_orders/purchase_orders/todos/announcements/payment_requests에 적용한
--    "본인 또는 관리자만 쓰기" 원칙에서 빠져 있었다. 지금은 로그인만 하면
--    아무나 다른 직원이 등록한 수금/지급 기록을 삭제할 수 있고(그러면
--    미수금/미지급 잔액이 조용히 되돌아간다), 등록할 때도 created_by를
--    다른 사람 것으로 조작해 넣을 수 있었다. 게다가 이 두 테이블은
--    migration 74의 감사로그 대상에도 빠져 있어서 삭제돼도 아무 기록이
--    안 남았다.
-- 2) create_payment_request_with_items / find_or_create_payment_request_bucket이
--    클라이언트가 보낸 p_requested_by를 그대로 믿고 저장했다 — migration 69가
--    create_sale_with_items 등에서 이미 막은 것과 같은 종류의 신원 위조
--    문제(브라우저에서 RPC를 직접 호출하며 다른 사람의 uuid를 넣으면 그
--    사람 명의로 지출 문서가 만들어짐)가 지급결의서 생성 경로에는 아직
--    남아있었다.
-- 3) todos 완료처리(markTodoSideDone, src/lib/todo-flow.ts)가 security definer
--    우회 없이 일반 update를 쓰고 있어서, "할일 가져오기"로 다른 직원이
--    등록한 할일을 가져와 매입/매출을 실제로 등록해도 RLS(본인 또는 관리자만
--    수정 가능)에 막혀 완료 처리가 조용히 실패했다 — migration 70이 수동
--    체크박스(toggle_todo_done)에는 이미 만들어준 security definer 우회를
--    이 자동 완료 경로에는 빠뜨렸다.

-- ── 1) customer_payments / supplier_payments ──────────────────────────

drop policy if exists "customer_payments_insert_authenticated" on public.customer_payments;
create policy "customer_payments_insert_owner_or_admin" on public.customer_payments
  for insert with check (created_by = auth.uid() or public.is_admin());

drop policy if exists "customer_payments_delete_authenticated" on public.customer_payments;
create policy "customer_payments_delete_owner_or_admin" on public.customer_payments
  for delete using (created_by = auth.uid() or public.is_admin());

drop policy if exists "supplier_payments_insert_authenticated" on public.supplier_payments;
create policy "supplier_payments_insert_owner_or_admin" on public.supplier_payments
  for insert with check (created_by = auth.uid() or public.is_admin());

drop policy if exists "supplier_payments_delete_authenticated" on public.supplier_payments;
create policy "supplier_payments_delete_owner_or_admin" on public.supplier_payments
  for delete using (created_by = auth.uid() or public.is_admin());

drop trigger if exists audit_customer_payments on public.customer_payments;
create trigger audit_customer_payments
  after insert or update or delete on public.customer_payments
  for each row execute procedure public.record_audit_log();

drop trigger if exists audit_supplier_payments on public.supplier_payments;
create trigger audit_supplier_payments
  after insert or update or delete on public.supplier_payments
  for each row execute procedure public.record_audit_log();

-- ── 2) 지급결의서 생성 RPC의 requested_by를 auth.uid()로 고정 ─────────

create or replace function public.create_payment_request_with_items(
  p_department text,
  p_period_from date,
  p_period_to date,
  p_card_type text,
  p_requested_by uuid, -- 신뢰하지 않음(migration 69와 같은 이유). 시그니처 유지 목적으로만 남김.
  p_items jsonb
)
returns uuid
language plpgsql
as $$
declare
  v_id uuid;
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;

  insert into public.payment_requests (department, period_from, period_to, card_type, requested_by)
  values (p_department, p_period_from, p_period_to, coalesce(nullif(p_card_type, ''), '개인카드'), v_actor)
  returning id into v_id;

  if jsonb_array_length(p_items) > 0 then
    insert into public.payment_request_line_items
      (payment_request_id, used_at, vendor, purpose, amount, remark, sort_order, is_highlighted)
    select
      v_id,
      (item->>'usedAt')::date,
      item->>'vendor',
      nullif(item->>'purpose', ''),
      (item->>'amount')::numeric,
      nullif(item->>'remark', ''),
      (item->>'sortOrder')::int,
      coalesce((item->>'isHighlighted')::boolean, false)
    from jsonb_array_elements(p_items) as item;
  end if;

  return v_id;
end;
$$;

create or replace function public.find_or_create_payment_request_bucket(
  p_department text,
  p_card_type text,
  p_month_key text,
  p_requested_by uuid -- 신뢰하지 않음(migration 69와 같은 이유). 시그니처 유지 목적으로만 남김.
)
returns uuid
language plpgsql
as $$
declare
  v_id uuid;
  v_period_from date;
  v_period_to date;
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;

  v_period_from := (p_month_key || '-01')::date;
  v_period_to := (v_period_from + interval '1 month - 1 day')::date;

  insert into public.payment_requests (department, period_from, period_to, card_type, requested_by, month_key)
  values (p_department, v_period_from, v_period_to, p_card_type, v_actor, p_month_key)
  on conflict (department, card_type, month_key, requested_by) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id
    from public.payment_requests
    where department = p_department and card_type = p_card_type and month_key = p_month_key
      and requested_by is not distinct from v_actor;
  end if;

  return v_id;
end;
$$;

-- ── 3) 할일 자동완료 처리(markTodoSideDone)를 위한 security definer RPC ──
-- toggle_todo_done과 동일한 이유: "할일 가져오기"는 본인이 만들지 않은
-- 할일도(다른 직원이 등록해둔 것) 목록에서 가져와 실제 매입/매출을
-- 등록할 수 있게 설계돼 있는데, 완료 표시 자체는 RLS(본인 또는 관리자만
-- 수정 가능)에 막혀 조용히 실패하고 있었다. security definer로 RLS를
-- 우회하되, 함수 내부에서 인증 여부만 확인한다(누구 할일이든 완료
-- 표시하는 것 자체는 이 앱의 정상적인 업무 흐름이다).
create or replace function public.mark_todo_side_done(p_id uuid, p_side text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
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
  from public.todos where id = p_id;

  if not found or v_done then
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

revoke all on function public.mark_todo_side_done(uuid, text) from public;
grant execute on function public.mark_todo_side_done(uuid, text) to authenticated;
