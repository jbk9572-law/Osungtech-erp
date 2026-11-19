-- 280: 일시반출 — 물건을 거래처에 "빌려줬다가 돌려받는" 거래(시연·테스트·위탁 샘플 등).
--
-- 매출 전표에 유형을 하나 더 얹지 않고 별도 장부(stock_loans)로 둔다 — 매출 데이터를 읽는 화면·집계가 많아(50곳 안팎) 하나라도 "반출은 제외"를
-- 빠뜨리면 반출이 매출·미수금·세금계산서에 섞이기 때문이다. 별도 장부는 그 위험이 처음부터 없다.
--
-- 재고는 창고 이동(stock_transfers)과 같은 방식: 새 계산 로직 없이 재고 원장(inventory_transactions)에 기록하면 apply_inventory_transaction() 트리거가
-- inventory.quantity 를 맞춘다(음수 재고 금지 규칙도 그대로 적용).
--   · 반출  : 반출 창고에 type='out'  (reference 'stock_loan:<id>')
--   · 반납  : 같은 창고에 type='in'   (reference 'stock_loan_return:<id>') — 일부 반납 가능, 품목별 미반납 수량을 장부가 들고 있다
--   · 취소  : 반납이 하나도 없을 때만. type='adjustment' 로 되돌린다(창고 이동 취소와 같은 방식)
-- 원가(FIFO 층)는 건드리지 않는다 — 돌아올 물건이라 원가 층이 소진되지 않는다.

create table public.stock_loans (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  -- 거래처·창고는 일부러 on delete 를 두지 않는다(NO ACTION): 반출 중인 건이 있는 거래처/창고는 지울 수 없어야 재고가 어긋나지 않는다.
  customer_id uuid not null references public.customers (id),
  warehouse_id uuid not null references public.warehouses (id),
  loan_date date not null default current_date,
  due_date date,
  status text not null default 'open' check (status in ('open', 'returned', 'cancelled')),
  memo text,
  is_demo boolean not null default public.is_demo_actor(),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  constraint stock_loans_due_after_loan check (due_date is null or due_date >= loan_date)
);

create index stock_loans_tenant_id_idx on public.stock_loans (tenant_id);
create index stock_loans_customer_id_idx on public.stock_loans (customer_id, loan_date desc);
create index stock_loans_open_idx on public.stock_loans (tenant_id, due_date) where status = 'open';

create table public.stock_loan_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  loan_id uuid not null references public.stock_loans (id) on delete cascade,
  product_id uuid not null references public.products (id),
  quantity numeric not null check (quantity > 0),
  returned_quantity numeric not null default 0 check (returned_quantity >= 0 and returned_quantity <= quantity),
  remark text,
  is_demo boolean not null default public.is_demo_actor(),
  created_at timestamptz not null default now()
);

create index stock_loan_items_loan_id_idx on public.stock_loan_items (loan_id);
create index stock_loan_items_tenant_id_idx on public.stock_loan_items (tenant_id);

alter table public.stock_loans enable row level security;
alter table public.stock_loan_items enable row level security;

create policy "stock_loans_tenant_isolation" on public.stock_loans
  as restrictive for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());
create policy "stock_loans_demo_isolation" on public.stock_loans
  as restrictive for all
  using (is_demo = public.is_demo_actor())
  with check (is_demo = public.is_demo_actor());
create policy "stock_loans_select_authenticated" on public.stock_loans for select using (auth.role() = 'authenticated');
create policy "stock_loans_insert_authenticated" on public.stock_loans for insert with check (auth.role() = 'authenticated');
create policy "stock_loans_update_authenticated" on public.stock_loans for update using (auth.role() = 'authenticated');
create policy "stock_loans_delete_authenticated" on public.stock_loans for delete using (auth.role() = 'authenticated');

create policy "stock_loan_items_tenant_isolation" on public.stock_loan_items
  as restrictive for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());
create policy "stock_loan_items_demo_isolation" on public.stock_loan_items
  as restrictive for all
  using (is_demo = public.is_demo_actor())
  with check (is_demo = public.is_demo_actor());
create policy "stock_loan_items_select_authenticated" on public.stock_loan_items for select using (auth.role() = 'authenticated');
create policy "stock_loan_items_insert_authenticated" on public.stock_loan_items for insert with check (auth.role() = 'authenticated');
create policy "stock_loan_items_update_authenticated" on public.stock_loan_items for update using (auth.role() = 'authenticated');
create policy "stock_loan_items_delete_authenticated" on public.stock_loan_items for delete using (auth.role() = 'authenticated');

-- 반납 수량·상태는 아래 함수로만 바뀐다 — 직원이 REST 로 직접 고치지 못하게 막는다(269의 guard_internal_stock_write 재사용).
create trigger stock_loans_guard_write before insert or update or delete on public.stock_loans
  for each row execute function public.guard_internal_stock_write();
create trigger stock_loan_items_guard_write before insert or update or delete on public.stock_loan_items
  for each row execute function public.guard_internal_stock_write();

-- 반출 등록: 재고 확인(같은 품목 여러 줄은 합산, 행 잠금) → 장부·품목 기록 → 재고 원장 out.
create or replace function public.create_stock_loan(
  p_customer_id uuid,
  p_warehouse_id uuid,
  p_loan_date date,
  p_due_date date,
  p_memo text,
  p_items jsonb
)
returns uuid
language plpgsql
as $$
declare
  v_actor uuid := auth.uid();
  v_loan_id uuid;
  v_item jsonb;
  v_product_id uuid;
  v_quantity numeric;
  v_available numeric;
  v_product_name text;
begin
  perform set_config('app.internal_write', 'on', true);
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;
  if not exists (select 1 from public.customers where id = p_customer_id) then
    raise exception '거래처를 찾을 수 없습니다.';
  end if;
  if not exists (select 1 from public.warehouses where id = p_warehouse_id) then
    raise exception '창고를 찾을 수 없습니다.';
  end if;
  if p_due_date is not null and p_due_date < p_loan_date then
    raise exception '반납 예정일은 반출일 이후여야 합니다.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception '반출할 품목을 1개 이상 입력해주세요.';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_quantity := (v_item->>'quantity')::numeric;
    if (v_item->>'productId') is null or v_quantity is null or v_quantity = 'NaN'::numeric or v_quantity <= 0 then
      raise exception '반출 수량은 0보다 커야 합니다.';
    end if;
  end loop;

  for v_product_id, v_quantity in
    select (item->>'productId')::uuid, sum((item->>'quantity')::numeric)
    from jsonb_array_elements(p_items) as item
    group by 1
  loop
    select i.quantity, p.name into v_available, v_product_name
    from public.inventory i
    join public.products p on p.id = v_product_id
    where i.product_id = v_product_id and i.warehouse_id = p_warehouse_id
    for update of i;

    if v_available is null then
      select name into v_product_name from public.products where id = v_product_id;
      raise exception '"%"의 재고가 0이라 반출할 수 없습니다.', coalesce(v_product_name, '품목');
    end if;
    if v_available < v_quantity then
      raise exception '"%"의 재고(%)가 반출 수량(%)보다 적습니다.', v_product_name, v_available, v_quantity;
    end if;
  end loop;

  insert into public.stock_loans (customer_id, warehouse_id, loan_date, due_date, memo, created_by)
  values (p_customer_id, p_warehouse_id, p_loan_date, p_due_date, nullif(trim(p_memo), ''), v_actor)
  returning id into v_loan_id;

  insert into public.stock_loan_items (loan_id, product_id, quantity, remark)
  select v_loan_id, (item->>'productId')::uuid, (item->>'quantity')::numeric, nullif(item->>'remark', '')
  from jsonb_array_elements(p_items) as item;

  insert into public.inventory_transactions (product_id, warehouse_id, type, quantity, reference, note, created_by)
  select (item->>'productId')::uuid, p_warehouse_id, 'out', (item->>'quantity')::numeric,
         'stock_loan:' || v_loan_id, '일시반출', v_actor
  from jsonb_array_elements(p_items) as item;

  return v_loan_id;
end;
$$;

-- 반납 처리: p_items = [{"itemId": "...", "quantity": n}] — 품목 줄별 반납 수량(미반납 수량 이하). 모두 돌아오면 장부가 'returned' 로 닫힌다. 새 상태를 돌려준다.
create or replace function public.return_stock_loan(p_loan_id uuid, p_items jsonb)
returns text
language plpgsql
as $$
declare
  v_actor uuid := auth.uid();
  v_status text;
  v_warehouse_id uuid;
  v_row record;
  v_outstanding numeric;
  v_left numeric;
begin
  perform set_config('app.internal_write', 'on', true);
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception '반납할 품목과 수량을 입력해주세요.';
  end if;

  select status, warehouse_id into v_status, v_warehouse_id from public.stock_loans where id = p_loan_id for update;
  if v_status is null then
    raise exception '반출 전표를 찾을 수 없습니다.';
  end if;
  if v_status <> 'open' then
    raise exception '이미 %된 반출 전표입니다.', case v_status when 'returned' then '반납 완료' else '취소' end;
  end if;

  -- 같은 줄이 여러 번 들어와도 합산해서 미반납 수량과 비교한다.
  for v_row in
    select (item->>'itemId')::uuid as item_id, sum((item->>'quantity')::numeric) as qty
    from jsonb_array_elements(p_items) as item
    group by 1
  loop
    if v_row.qty is null or v_row.qty = 'NaN'::numeric or v_row.qty <= 0 then
      raise exception '반납 수량은 0보다 커야 합니다.';
    end if;
    select quantity - returned_quantity into v_outstanding
    from public.stock_loan_items where id = v_row.item_id and loan_id = p_loan_id
    for update;
    if v_outstanding is null then
      raise exception '반출 품목을 찾을 수 없습니다.';
    end if;
    if v_row.qty > v_outstanding then
      raise exception '반납 수량(%)이 미반납 수량(%)보다 많습니다.', v_row.qty, v_outstanding;
    end if;

    update public.stock_loan_items set returned_quantity = returned_quantity + v_row.qty where id = v_row.item_id;
    insert into public.inventory_transactions (product_id, warehouse_id, type, quantity, reference, note, created_by)
    select product_id, v_warehouse_id, 'in', v_row.qty, 'stock_loan_return:' || p_loan_id, '일시반출 반납', v_actor
    from public.stock_loan_items where id = v_row.item_id;
  end loop;

  select coalesce(sum(quantity - returned_quantity), 0) into v_left from public.stock_loan_items where loan_id = p_loan_id;
  if v_left = 0 then
    update public.stock_loans set status = 'returned', closed_at = now() where id = p_loan_id;
    return 'returned';
  end if;
  return 'open';
end;
$$;

-- 반출 취소: 반납이 하나도 없는 '반출 중' 전표만(일부라도 돌아왔으면 취소 대신 나머지를 반납 처리). 재고를 되돌린다. 본인 전표 또는 관리자만.
create or replace function public.cancel_stock_loan(p_loan_id uuid)
returns void
language plpgsql
as $$
declare
  v_actor uuid := auth.uid();
  v_owner uuid;
  v_status text;
  v_warehouse_id uuid;
begin
  perform set_config('app.internal_write', 'on', true);
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;
  select created_by, status, warehouse_id into v_owner, v_status, v_warehouse_id
  from public.stock_loans where id = p_loan_id for update;
  if v_status is null then
    raise exception '반출 전표를 찾을 수 없습니다.';
  end if;
  if v_owner is distinct from v_actor and not public.is_admin() then
    raise exception '본인이 등록한 반출 전표만 취소할 수 있습니다.';
  end if;
  if v_status <> 'open' then
    raise exception '반출 중인 전표만 취소할 수 있습니다.';
  end if;
  if exists (select 1 from public.stock_loan_items where loan_id = p_loan_id and returned_quantity > 0) then
    raise exception '이미 일부 반납된 전표는 취소할 수 없습니다. 나머지 수량을 반납 처리해주세요.';
  end if;

  insert into public.inventory_transactions (product_id, warehouse_id, type, quantity, reference, note, created_by)
  select product_id, v_warehouse_id, 'adjustment', quantity, 'stock_loan_cancel:' || p_loan_id, '일시반출 취소(복원)', v_actor
  from public.stock_loan_items where loan_id = p_loan_id;

  update public.stock_loans set status = 'cancelled', closed_at = now() where id = p_loan_id;
end;
$$;

revoke all on function public.create_stock_loan(uuid, uuid, date, date, text, jsonb) from public;
grant execute on function public.create_stock_loan(uuid, uuid, date, date, text, jsonb) to authenticated;
revoke all on function public.return_stock_loan(uuid, jsonb) from public;
grant execute on function public.return_stock_loan(uuid, jsonb) to authenticated;
revoke all on function public.cancel_stock_loan(uuid) from public;
grant execute on function public.cancel_stock_loan(uuid) to authenticated;
