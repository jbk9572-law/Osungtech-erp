-- 보관위치(랙) 재고를 등록/수정/삭제(=나감)해도 그 기록이 전혀 안
-- 남고 사라진다는 지적 — inventory_transactions(재고 조정 이력)와 같은
-- 방식으로, inventory_locations 전용 이력 테이블을 따로 둔다. audit_logs
-- (범용 변경 이력)를 재사용하지 않는 이유는, 그 테이블은 위치코드/품목명을
-- UUID로만 남겨서 나중에 "어느 위치에서 뭐가 나갔는지"를 사람이 읽으려면
-- 매번 조회맵이 필요하기 때문이다 — 여기서는 이벤트 시점의 위치코드/
-- 품목명/규격을 그대로 스냅샷으로 남겨서, 나중에 그 위치나 품목이
-- 삭제/변경돼도 이력 문장 자체는 그대로 읽을 수 있게 한다.
create table if not exists public.location_stock_history (
  id uuid primary key default gen_random_uuid(),
  location_id uuid references public.locations (id) on delete set null,
  location_code text not null,
  product_id uuid references public.products (id) on delete set null,
  product_sku text,
  product_name text,
  product_spec text,
  previous_quantity numeric,
  new_quantity numeric,
  actor uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  is_demo boolean not null default public.is_demo_actor()
);

create index if not exists location_stock_history_location_idx
  on public.location_stock_history (location_id, created_at desc);
create index if not exists location_stock_history_created_at_idx
  on public.location_stock_history (created_at desc);

alter table public.location_stock_history enable row level security;

-- 이 이력은 창고에서 실제로 실사/보관 작업을 하는 직원 누구나 볼 수
-- 있어야 쓸모가 있다(관리자 전용인 audit_logs와 다른 이유) — 나머지
-- 위치 관련 테이블과 같은 패턴으로 로그인한 사용자면 조회 가능.
create policy "location_stock_history_select_authenticated" on public.location_stock_history
  for select using (auth.role() = 'authenticated');

-- 쓰기는 아래 record_location_stock_history() 트리거(security definer)를
-- 통해서만 이뤄지므로 insert/update/delete 정책은 주지 않는다(RLS 기본값
-- 거부가 그대로 적용된다).

create policy "location_stock_history_demo_isolation" on public.location_stock_history
  as restrictive
  for all
  using (is_demo = public.is_demo_actor())
  with check (is_demo = public.is_demo_actor());

create or replace function public.record_location_stock_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_location_id uuid := coalesce(new.location_id, old.location_id);
  v_product_id uuid := coalesce(new.product_id, old.product_id);
  v_location_code text;
  v_product_sku text;
  v_product_name text;
  v_product_spec text;
  v_previous numeric;
  v_new numeric;
begin
  select code into v_location_code from public.locations where id = v_location_id;
  select sku, name, spec into v_product_sku, v_product_name, v_product_spec
    from public.products where id = v_product_id;

  if (tg_op = 'INSERT') then
    v_previous := null;
    v_new := new.quantity;
  elsif (tg_op = 'UPDATE') then
    v_previous := old.quantity;
    v_new := new.quantity;
  else
    v_previous := old.quantity;
    v_new := null;
  end if;

  insert into public.location_stock_history (
    location_id, location_code, product_id, product_sku, product_name, product_spec,
    previous_quantity, new_quantity, actor
  ) values (
    v_location_id, coalesce(v_location_code, '(삭제된 위치)'), v_product_id, v_product_sku, v_product_name,
    v_product_spec, v_previous, v_new, auth.uid()
  );

  if (tg_op = 'DELETE') then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.record_location_stock_history() from public;

drop trigger if exists location_stock_history_trigger on public.inventory_locations;
create trigger location_stock_history_trigger
  after insert or update or delete on public.inventory_locations
  for each row execute procedure public.record_location_stock_history();
