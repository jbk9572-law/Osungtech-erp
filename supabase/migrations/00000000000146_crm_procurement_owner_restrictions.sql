-- migration 070(owner_or_admin_write_restrictions)이 매출/매입/할일/공지에
-- 적용한 "작성자 본인 또는 관리자만 수정·삭제" 규칙이, 그 이후에 추가된
-- CRM/구매요청 계열 테이블(quotes, sales_activities, purchase_requests,
-- purchase_quote_requests)에는 전혀 적용되지 않은 채로 남아 있었다 —
-- 전체 코드베이스 감사에서 발견. 지금은 로그인만 하면 다른 사람이 작성한
-- 견적서/영업활동/구매요청/구매견적요청을 누구나 수정·삭제·전환할 수
-- 있다(서버 액션에도 작성자 확인이 없어 RLS가 유일한 방어선인데, 그
-- RLS 자체가 authenticated면 통과였다). 동일한 owner-or-admin 패턴으로
-- 좁힌다.

-- ── 견적서(quotes) ───────────────────────────────────────────
drop policy if exists "quotes_update_authenticated" on public.quotes;
create policy "quotes_update_owner_or_admin" on public.quotes
  for update using (created_by = auth.uid() or public.is_admin());

drop policy if exists "quotes_delete_authenticated" on public.quotes;
create policy "quotes_delete_owner_or_admin" on public.quotes
  for delete using (created_by = auth.uid() or public.is_admin());

drop policy if exists "quote_items_update_authenticated" on public.quote_items;
create policy "quote_items_update_owner_or_admin" on public.quote_items
  for update using (
    exists (select 1 from public.quotes q where q.id = quote_items.quote_id and (q.created_by = auth.uid() or public.is_admin()))
  );

drop policy if exists "quote_items_delete_authenticated" on public.quote_items;
create policy "quote_items_delete_owner_or_admin" on public.quote_items
  for delete using (
    exists (select 1 from public.quotes q where q.id = quote_items.quote_id and (q.created_by = auth.uid() or public.is_admin()))
  );

-- ── 영업활동(sales_activities) ───────────────────────────────
drop policy if exists "sales_activities_update_authenticated" on public.sales_activities;
create policy "sales_activities_update_owner_or_admin" on public.sales_activities
  for update using (created_by = auth.uid() or public.is_admin());

drop policy if exists "sales_activities_delete_authenticated" on public.sales_activities;
create policy "sales_activities_delete_owner_or_admin" on public.sales_activities
  for delete using (created_by = auth.uid() or public.is_admin());

-- ── 구매요청(purchase_requests) ──────────────────────────────
-- submit_purchase_request/recall_purchase_request RPC는 이미 자체적으로
-- 작성자(requested_by)를 확인하지만, RPC를 우회해 테이블을 직접
-- update/delete하는 경로(삭제 버튼, 향후 추가될 수정 화면)는 막혀있지
-- 않았다.
drop policy if exists "purchase_requests_update_authenticated" on public.purchase_requests;
create policy "purchase_requests_update_owner_or_admin" on public.purchase_requests
  for update using (requested_by = auth.uid() or public.is_admin());

drop policy if exists "purchase_requests_delete_authenticated" on public.purchase_requests;
create policy "purchase_requests_delete_owner_or_admin" on public.purchase_requests
  for delete using (requested_by = auth.uid() or public.is_admin());

drop policy if exists "purchase_request_items_update_authenticated" on public.purchase_request_items;
create policy "purchase_request_items_update_owner_or_admin" on public.purchase_request_items
  for update using (
    exists (
      select 1 from public.purchase_requests pr
      where pr.id = purchase_request_items.purchase_request_id and (pr.requested_by = auth.uid() or public.is_admin())
    )
  );

drop policy if exists "purchase_request_items_delete_authenticated" on public.purchase_request_items;
create policy "purchase_request_items_delete_owner_or_admin" on public.purchase_request_items
  for delete using (
    exists (
      select 1 from public.purchase_requests pr
      where pr.id = purchase_request_items.purchase_request_id and (pr.requested_by = auth.uid() or public.is_admin())
    )
  );

-- ── 구매 견적요청(purchase_quote_requests, RFQ) ───────────────
drop policy if exists "purchase_quote_requests_update_authenticated" on public.purchase_quote_requests;
create policy "purchase_quote_requests_update_owner_or_admin" on public.purchase_quote_requests
  for update using (created_by = auth.uid() or public.is_admin());

drop policy if exists "purchase_quote_requests_delete_authenticated" on public.purchase_quote_requests;
create policy "purchase_quote_requests_delete_owner_or_admin" on public.purchase_quote_requests
  for delete using (created_by = auth.uid() or public.is_admin());

drop policy if exists "purchase_quote_request_items_delete_authenticated" on public.purchase_quote_request_items;
create policy "purchase_quote_request_items_delete_owner_or_admin" on public.purchase_quote_request_items
  for delete using (
    exists (
      select 1 from public.purchase_quote_requests r
      where r.id = purchase_quote_request_items.purchase_quote_request_id and (r.created_by = auth.uid() or public.is_admin())
    )
  );

-- purchase_quote_prices는 견적요청 작성자가 아니라 "그 공급처에서 실제로
-- 견적을 받은 담당 직원"이 입력하는 경우가 흔해서(누가 어느 공급처를
-- 맡을지는 작성자와 무관) insert처럼 update/delete도 인증된 누구나
-- 가능하게 그대로 둔다 — 여기서 고치는 건 delete 정책이 아예 없던
-- 결함뿐이다. set_purchase_quote_prices() RPC(security definer 아님)가
-- "지우고 다시 넣기" 패턴으로 매번 delete부터 실행하는데, 정책 자체가
-- 없으면 RLS 기본값(전면 차단)에 걸려 그 delete가 0건으로 조용히
-- 실패하고, 이미 저장된 값이 있는 상태에서 재저장하면
-- unique(item_id, supplier_id) 위반으로 저장 자체가 에러난다.
create policy "purchase_quote_prices_delete_authenticated" on public.purchase_quote_prices
  for delete using (auth.role() = 'authenticated');

-- convert_purchase_quote_request()는 이 함수 안에서 purchase_quote_requests를
-- update하는데, 방금 그 update 정책을 owner-or-admin으로 좁혔다. 이
-- 함수는 security definer가 아니라서(호출자 신원 그대로 RLS를 통과해야
-- 함) 작성자가 아닌 사람이 호출하면 update가 0건으로 조용히 실패하고도
-- 함수는 새로 만든 구매요청 id를 그대로 반환해버린다(방금 만든 구매
-- 요청은 정상 생성되지만, 원본 견적요청은 closed로 안 바뀌어 다른
-- 사람이 또 전환을 시도할 수 있는 반쪽짜리 상태가 된다) —
-- submit_purchase_request와 동일하게 맨 앞에서 명시적으로 확인한다.
create or replace function public.convert_purchase_quote_request(
  p_id uuid,
  p_supplier_id uuid
)
returns uuid
language plpgsql
as $$
declare
  v_actor uuid := auth.uid();
  v_status text;
  v_owner uuid;
  v_target_supplier_ids uuid[];
  v_request_id uuid;
  v_items jsonb;
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;

  select status, created_by, target_supplier_ids into v_status, v_owner, v_target_supplier_ids
  from public.purchase_quote_requests where id = p_id;

  if v_status is null then
    raise exception '견적요청을 찾을 수 없습니다.';
  end if;
  if v_owner is distinct from v_actor and not public.is_admin() then
    raise exception '본인이 작성한 견적요청만 전환할 수 있습니다.';
  end if;
  if v_status <> 'open' then
    raise exception '이미 처리된 견적요청입니다.';
  end if;
  if not (p_supplier_id = any(v_target_supplier_ids)) then
    raise exception '견적을 요청하지 않은 공급처입니다.';
  end if;

  select jsonb_agg(jsonb_build_object(
    'productId', i.product_id,
    'customName', i.custom_name,
    'spec', i.spec,
    'quantity', i.quantity,
    'estimatedUnitPrice', coalesce(pr.unit_price, 0),
    'remark', i.remark
  ))
  into v_items
  from public.purchase_quote_request_items i
  left join public.purchase_quote_prices pr
    on pr.purchase_quote_request_item_id = i.id and pr.supplier_id = p_supplier_id
  where i.purchase_quote_request_id = p_id;

  v_request_id := public.create_purchase_request_with_items(p_supplier_id, current_date, '견적요청에서 전환', coalesce(v_items, '[]'::jsonb));

  update public.purchase_quote_requests
  set status = 'closed', selected_supplier_id = p_supplier_id, converted_purchase_request_id = v_request_id
  where id = p_id;

  return v_request_id;
end;
$$;
