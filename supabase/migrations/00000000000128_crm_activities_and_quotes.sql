-- CRM/영업관리 1단계: 영업활동 기록 + 견적서.
--
-- 지금까지 거래처관리(customers)는 순수 마스터데이터 + 미수금 화면이었고,
-- 매출관리(sales_orders)는 이미 발생한 거래를 증빙(출고증/명세표)하는
-- 화면이라 "영업" 자체를 관리할 방법이 없었다(상담/방문 이력도 없고,
-- 정식 주문 전 견적 단계도 없음). 이번에 두 가지를 추가한다:
--   1) sales_activities: 거래처별 상담/방문/전화 이력 + 다음 팔로우업 예정일
--   2) quotes/quote_items: 견적서. 승인되면 매출(sales_orders)로 그대로
--      전환한다(품목을 다시 입력할 필요 없이) — create_sale_with_items를
--      호출하는 서버 액션에서 처리하고, DB에는 전환 결과 링크만 남긴다.
--
-- 두 테이블 모두 다른 업무 테이블과 동일한 tenant_id(RESTRICTIVE) +
-- is_demo(RESTRICTIVE) 이중 격리를 그대로 따른다(migration 85/99 패턴).

create table public.sales_activities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  activity_type text not null default '기타' check (activity_type in ('전화', '방문', '이메일', '기타')),
  subject text not null,
  content text,
  activity_date date not null default current_date,
  next_action_date date,
  next_action_memo text,
  next_action_done boolean not null default false,
  is_demo boolean not null default public.is_demo_actor(),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index sales_activities_tenant_id_idx on public.sales_activities (tenant_id);
create index sales_activities_customer_id_idx on public.sales_activities (customer_id, activity_date desc);
create index sales_activities_next_action_idx on public.sales_activities (next_action_date) where next_action_done = false;

alter table public.sales_activities enable row level security;

create policy "sales_activities_tenant_isolation" on public.sales_activities
  as restrictive
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy "sales_activities_demo_isolation" on public.sales_activities
  as restrictive
  for all
  using (is_demo = public.is_demo_actor())
  with check (is_demo = public.is_demo_actor());

create policy "sales_activities_select_authenticated" on public.sales_activities
  for select using (auth.role() = 'authenticated');
create policy "sales_activities_insert_authenticated" on public.sales_activities
  for insert with check (auth.role() = 'authenticated');
create policy "sales_activities_update_authenticated" on public.sales_activities
  for update using (auth.role() = 'authenticated');
create policy "sales_activities_delete_authenticated" on public.sales_activities
  for delete using (auth.role() = 'authenticated');

create sequence public.quotes_doc_no_seq;

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  doc_no bigint not null default nextval('public.quotes_doc_no_seq'),
  quote_date date not null default current_date,
  valid_until date,
  status text not null default 'draft' check (status in ('draft', 'sent', 'accepted', 'rejected', 'expired')),
  memo text,
  converted_sales_order_id uuid references public.sales_orders (id) on delete set null,
  is_demo boolean not null default public.is_demo_actor(),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index quotes_tenant_id_idx on public.quotes (tenant_id);
create index quotes_customer_id_idx on public.quotes (customer_id, quote_date desc);

alter table public.quotes enable row level security;

create policy "quotes_tenant_isolation" on public.quotes
  as restrictive
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy "quotes_demo_isolation" on public.quotes
  as restrictive
  for all
  using (is_demo = public.is_demo_actor())
  with check (is_demo = public.is_demo_actor());

create policy "quotes_select_authenticated" on public.quotes
  for select using (auth.role() = 'authenticated');
create policy "quotes_insert_authenticated" on public.quotes
  for insert with check (auth.role() = 'authenticated');
create policy "quotes_update_authenticated" on public.quotes
  for update using (auth.role() = 'authenticated');
create policy "quotes_delete_authenticated" on public.quotes
  for delete using (auth.role() = 'authenticated');

create table public.quote_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  quote_id uuid not null references public.quotes (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  custom_name text,
  spec text,
  quantity numeric not null,
  unit_price numeric not null default 0,
  remark text,
  is_demo boolean not null default public.is_demo_actor(),
  created_at timestamptz not null default now()
);

create index quote_items_quote_id_idx on public.quote_items (quote_id);
create index quote_items_tenant_id_idx on public.quote_items (tenant_id);

alter table public.quote_items enable row level security;

-- sales_order_items와 동일한 패턴: tenant_id/is_demo RESTRICTIVE로 실제
-- 격리를 걸고, 그 위에 인증된 사용자면 누구나 쓸 수 있는 PERMISSIVE
-- 정책을 얹는다(migration 4/99 참고).
create policy "quote_items_tenant_isolation" on public.quote_items
  as restrictive
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy "quote_items_demo_isolation" on public.quote_items
  as restrictive
  for all
  using (is_demo = public.is_demo_actor())
  with check (is_demo = public.is_demo_actor());

create policy "quote_items_select_authenticated" on public.quote_items
  for select using (auth.role() = 'authenticated');
create policy "quote_items_insert_authenticated" on public.quote_items
  for insert with check (auth.role() = 'authenticated');
create policy "quote_items_update_authenticated" on public.quote_items
  for update using (auth.role() = 'authenticated');
create policy "quote_items_delete_authenticated" on public.quote_items
  for delete using (auth.role() = 'authenticated');

-- 견적 + 품목을 원자적으로 생성한다(sales_orders의 create_sale_with_items와
-- 동일한 패턴). v_actor가 없으면(로그인 세션 없음) 막는다 — migration 69의
-- "신원 위조 방지" 원칙을 그대로 따른다.
create or replace function public.create_quote_with_items(
  p_customer_id uuid,
  p_quote_date date,
  p_valid_until date,
  p_memo text,
  p_items jsonb
)
returns uuid
language plpgsql
as $$
declare
  v_quote_id uuid;
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;

  insert into public.quotes (customer_id, quote_date, valid_until, memo, created_by)
  values (p_customer_id, p_quote_date, p_valid_until, p_memo, v_actor)
  returning id into v_quote_id;

  if jsonb_array_length(p_items) > 0 then
    insert into public.quote_items (quote_id, product_id, custom_name, spec, quantity, unit_price, remark)
    select
      v_quote_id,
      nullif(item->>'productId', '')::uuid,
      nullif(item->>'customName', ''),
      nullif(item->>'spec', ''),
      (item->>'quantity')::numeric,
      (item->>'unitPrice')::numeric,
      nullif(item->>'remark', '')
    from jsonb_array_elements(p_items) as item;
  end if;

  return v_quote_id;
end;
$$;
