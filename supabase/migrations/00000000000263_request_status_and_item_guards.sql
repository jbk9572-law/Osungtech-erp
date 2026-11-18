-- 263: 직원이 REST로 직접 할 수 있던 위조/오용 차단.
--  1) 지급결의서·구매요청 상태를 직접 approved/rejected 로 바꾸거나, 승인된 문서를 고치는 것
--  2) 남의 지급결의서/구매요청/견적서에 품목·영수증을 끼워 넣는 것
--  3) 남이 등록한 외주 지급 내역 삭제
--  4) 포털 계정을 다른 거래처/사용자로 재배정

-- 1) 상태 가드. 결재 완료 반영(sync_*_from_approval)은 definer 라 current_user 가 소유자여서 그대로 통과한다.
create or replace function public.guard_request_status_write()
returns trigger
language plpgsql
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if public.is_admin() or public.is_sandbox_tenant() then
    return new;
  end if;
  if new.status is distinct from old.status then
    if not (
      (old.status in ('draft', 'rejected') and new.status in ('draft', 'pending'))
      or (old.status = 'pending' and new.status = 'draft')
    ) then
      raise exception '결재 상태는 직접 바꿀 수 없습니다. (% → %)', old.status, new.status;
    end if;
  elsif old.status = 'approved' then
    raise exception '승인 완료된 문서는 수정할 수 없습니다.';
  end if;
  return new;
end;
$$;

drop trigger if exists payment_requests_guard_status on public.payment_requests;
create trigger payment_requests_guard_status
  before update on public.payment_requests
  for each row execute function public.guard_request_status_write();
drop trigger if exists purchase_requests_guard_status on public.purchase_requests;
create trigger purchase_requests_guard_status
  before update on public.purchase_requests
  for each row execute function public.guard_request_status_write();

-- 2) 품목/영수증 추가는 부모 문서 작성자(또는 관리자)만, 승인 완료 문서에는 불가.
drop policy if exists "payment_request_line_items_insert_authenticated" on public.payment_request_line_items;
create policy "payment_request_line_items_insert_authenticated" on public.payment_request_line_items
  for insert with check (exists (
    select 1 from public.payment_requests pr
    where pr.id = payment_request_line_items.payment_request_id
      and (pr.requested_by = auth.uid() or public.is_admin()) and pr.status <> 'approved'));

drop policy if exists "payment_request_receipts_insert_authenticated" on public.payment_request_receipts;
create policy "payment_request_receipts_insert_authenticated" on public.payment_request_receipts
  for insert with check (exists (
    select 1 from public.payment_requests pr
    where pr.id = payment_request_receipts.payment_request_id
      and (pr.requested_by = auth.uid() or public.is_admin()) and pr.status <> 'approved'));

drop policy if exists "purchase_request_items_insert_authenticated" on public.purchase_request_items;
create policy "purchase_request_items_insert_authenticated" on public.purchase_request_items
  for insert with check (exists (
    select 1 from public.purchase_requests pr
    where pr.id = purchase_request_items.purchase_request_id
      and (pr.requested_by = auth.uid() or public.is_admin()) and pr.status <> 'approved'));

drop policy if exists "quote_items_insert_authenticated" on public.quote_items;
create policy "quote_items_insert_authenticated" on public.quote_items
  for insert with check (exists (
    select 1 from public.quotes q
    where q.id = quote_items.quote_id and (q.created_by = auth.uid() or public.is_admin())));

-- 3) 외주 지급 내역 삭제: 등록자 또는 관리자만.
drop policy if exists "subcontractor_payments_delete_authenticated" on public.subcontractor_payments;
create policy "subcontractor_payments_delete_authenticated" on public.subcontractor_payments
  for delete using (created_by = auth.uid() or public.is_admin());

-- 4) 포털 계정: 일반 직원은 disabled(사용 중지/재개)만 바꿀 수 있다. 연결 대상·사용자·아이디 재배정은 관리자만.
create or replace function public.guard_portal_account_update()
returns trigger
language plpgsql
as $$
begin
  if current_user not in ('authenticated', 'anon') or public.is_admin() then
    return new;
  end if;
  if (to_jsonb(new) - 'disabled') is distinct from (to_jsonb(old) - 'disabled') then
    raise exception '포털 계정의 연결 대상은 관리자만 바꿀 수 있습니다. 사용 중지/재개만 가능합니다.';
  end if;
  return new;
end;
$$;
drop trigger if exists customer_portal_accounts_guard_update on public.customer_portal_accounts;
create trigger customer_portal_accounts_guard_update
  before update on public.customer_portal_accounts
  for each row execute function public.guard_portal_account_update();
