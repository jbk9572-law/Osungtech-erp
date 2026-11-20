-- 수량·단가 칸에 엑셀식("=600*2")으로 입력한 계산식의 공용 저장소 — 앱 전체 화면이 같은 방식으로 식을 남기고 다시 보여주기 위함.
-- (276의 전표별 item_formulas 칸은 매출/매입 전표에만 붙는 방식이라 화면마다 규칙이 갈라진다 → 이 표로 통일하고 그 칸은 지운다.
--  276은 아직 운영에 나가지 않았고 식 데이터도 없다.)
-- 한 줄 = (화면 종류 entity, 전표/문서 id, 줄 키 line_key, 칸 field)의 식. 줄 키는 품목 키(lib/item-formulas.itemKey)처럼 화면이 정한다.
-- 줄 순서가 저장 때마다 바뀔 수 있어 위치가 아니라 "줄 키 + 식 결과가 현재 값과 같은지"로 짝짓는다(읽는 쪽 lib/item-formulas.ts).
-- 식은 보조 정보 — 핵심 재고/금액 함수는 건드리지 않고, 전표 저장 후 따로 기록한다(실패해도 전표는 성공).
create table if not exists public.input_formulas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  is_demo boolean not null default public.is_demo_actor(),
  entity text not null check (char_length(entity) between 1 and 40),
  entity_id uuid not null,
  line_key text not null check (char_length(line_key) <= 200),
  field text not null check (field in ('quantity', 'unit_price')),
  formula text not null check (char_length(formula) between 2 and 80 and left(formula, 1) = '='),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists input_formulas_tenant_id_idx on public.input_formulas (tenant_id);
create index if not exists input_formulas_entity_idx on public.input_formulas (entity, entity_id);

alter table public.input_formulas enable row level security;

-- 조회/등록/삭제는 로그인한 같은 회사 사용자(식은 전표 옆 참고 정보라 작성자 제한은 두지 않는다). 수정은 지우고 다시 쓰는 방식이라 정책을 열지 않는다.
create policy "input_formulas_select_authenticated" on public.input_formulas
  for select using (auth.role() = 'authenticated');
create policy "input_formulas_insert_authenticated" on public.input_formulas
  for insert with check (auth.role() = 'authenticated');
create policy "input_formulas_delete_authenticated" on public.input_formulas
  for delete using (auth.role() = 'authenticated');
create policy "input_formulas_demo_isolation" on public.input_formulas
  as restrictive for all
  using (is_demo = public.is_demo_actor()) with check (is_demo = public.is_demo_actor());
create policy "input_formulas_tenant_isolation" on public.input_formulas
  as restrictive for all
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

-- 전표를 지우면 그 전표의 식도 같이 지운다(DB 함수와 별개의 트리거 — 재고 핵심 함수는 그대로).
create or replace function public.delete_input_formulas_of_entity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.input_formulas where entity = tg_argv[0] and entity_id = old.id;
  return old;
end;
$$;

drop trigger if exists sales_orders_delete_formulas on public.sales_orders;
create trigger sales_orders_delete_formulas after delete on public.sales_orders
  for each row execute function public.delete_input_formulas_of_entity('sales_order');
drop trigger if exists purchase_orders_delete_formulas on public.purchase_orders;
create trigger purchase_orders_delete_formulas after delete on public.purchase_orders
  for each row execute function public.delete_input_formulas_of_entity('purchase_order');

-- 276에서 만든 전표별 칸은 쓰지 않는다.
alter table public.sales_orders drop column if exists item_formulas;
alter table public.purchase_orders drop column if exists item_formulas;
