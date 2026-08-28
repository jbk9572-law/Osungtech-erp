-- 변경 이력(감사 로그).
--
-- 매출/매입/품목/거래처(매입처·출고처)/계정 권한처럼 "누가 언제 뭘
-- 고쳤는지" 나중에 확인할 필요가 있는 핵심 테이블에 한해, insert/update/
-- delete를 트리거로 가로채 audit_logs에 스냅샷을 남긴다. 품목 단위 하위
-- 테이블(sales_order_items 등)이나 부가 테이블까지 전부 남기면 노이즈가
-- 너무 커지므로, 실제로 되짚어볼 일이 있는 헤더/마스터 테이블만 우선
-- 남긴다.
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id uuid not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  actor uuid references public.profiles (id) on delete set null,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_table_record_idx on public.audit_logs (table_name, record_id);
create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at desc);

alter table public.audit_logs enable row level security;

-- 조회는 관리자만 허용한다. 쓰기는 아래 record_audit_log()(security definer)
-- 트리거를 통해서만 이뤄지므로, 일반 사용자에게는 insert/update/delete
-- 정책을 아예 주지 않는다 — RLS 기본값(거부)이 그대로 적용된다.
create policy "audit_logs_select_admin" on public.audit_logs
  for select using (public.is_admin());

-- 테이블마다 따로 함수를 만들 필요 없이, tg_table_name/NEW.id/OLD.id로
-- 어느 테이블의 어느 행인지 알아낸다(아래 대상 테이블은 전부 id uuid PK를
-- 쓴다는 전제). auth.uid()는 이 트랜잭션을 실제로 일으킨 사용자 — RPC가
-- 대신 넣어주는 created_by/updated_by 값보다 신뢰할 수 있다(migration 69와
-- 같은 이유).
create or replace function public.record_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    insert into public.audit_logs (table_name, record_id, action, actor, new_data)
    values (tg_table_name, new.id, 'insert', auth.uid(), to_jsonb(new));
    return new;
  elsif (tg_op = 'UPDATE') then
    insert into public.audit_logs (table_name, record_id, action, actor, old_data, new_data)
    values (tg_table_name, new.id, 'update', auth.uid(), to_jsonb(old), to_jsonb(new));
    return new;
  elsif (tg_op = 'DELETE') then
    insert into public.audit_logs (table_name, record_id, action, actor, old_data)
    values (tg_table_name, old.id, 'delete', auth.uid(), to_jsonb(old));
    return old;
  end if;
  return null;
end;
$$;

revoke all on function public.record_audit_log() from public;

drop trigger if exists audit_sales_orders on public.sales_orders;
create trigger audit_sales_orders
  after insert or update or delete on public.sales_orders
  for each row execute procedure public.record_audit_log();

drop trigger if exists audit_purchase_orders on public.purchase_orders;
create trigger audit_purchase_orders
  after insert or update or delete on public.purchase_orders
  for each row execute procedure public.record_audit_log();

drop trigger if exists audit_products on public.products;
create trigger audit_products
  after insert or update or delete on public.products
  for each row execute procedure public.record_audit_log();

drop trigger if exists audit_customers on public.customers;
create trigger audit_customers
  after insert or update or delete on public.customers
  for each row execute procedure public.record_audit_log();

drop trigger if exists audit_suppliers on public.suppliers;
create trigger audit_suppliers
  after insert or update or delete on public.suppliers
  for each row execute procedure public.record_audit_log();

-- 권한(role) 변경처럼 민감한 변경도 남긴다.
drop trigger if exists audit_profiles on public.profiles;
create trigger audit_profiles
  after insert or update or delete on public.profiles
  for each row execute procedure public.record_audit_log();
