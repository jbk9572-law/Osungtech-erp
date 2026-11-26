-- 매출·매입 품목의 "입력한 순서"(line_no)를 저장한다.
-- 그동안은 품목이 생성 시각(created_at)만 가지고 있었고, 한 전표의 품목은 한 번에 저장돼 시각이 전부 같아서
-- 화면마다(목록·상세·인쇄·수정·공유 이미지) 순서가 DB 마음대로였다.
-- 저장 함수(등록·수정·가져오기 등)를 하나하나 고치지 않고, 삽입 시 트리거가 전표 안에서 1,2,3…을 붙인다
-- (같은 문장으로 여러 줄을 넣어도 들어온 순서대로 붙는다 — 전표 수정은 지우고 다시 넣으므로 매번 1부터).
-- 기존 전표는 원래 입력 순서가 저장된 적이 없어, 현재 보이던 순서(created_at, id)로 번호를 고정한다.

alter table public.sales_order_items add column if not exists line_no integer;
alter table public.purchase_order_items add column if not exists line_no integer;

update public.sales_order_items s
   set line_no = r.rn
  from (select id, row_number() over (partition by sales_order_id order by created_at, id) as rn from public.sales_order_items) r
 where s.id = r.id and s.line_no is null;

update public.purchase_order_items p
   set line_no = r.rn
  from (select id, row_number() over (partition by purchase_order_id order by created_at, id) as rn from public.purchase_order_items) r
 where p.id = r.id and p.line_no is null;

create index if not exists sales_order_items_order_line_idx on public.sales_order_items (sales_order_id, line_no);
create index if not exists purchase_order_items_order_line_idx on public.purchase_order_items (purchase_order_id, line_no);

create or replace function public.set_sales_order_item_line_no() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.line_no is null then
    select coalesce(max(line_no), 0) + 1 into new.line_no from public.sales_order_items where sales_order_id = new.sales_order_id;
  end if;
  return new;
end $$;

create or replace function public.set_purchase_order_item_line_no() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.line_no is null then
    select coalesce(max(line_no), 0) + 1 into new.line_no from public.purchase_order_items where purchase_order_id = new.purchase_order_id;
  end if;
  return new;
end $$;

drop trigger if exists sales_order_items_line_no on public.sales_order_items;
create trigger sales_order_items_line_no before insert on public.sales_order_items
  for each row execute function public.set_sales_order_item_line_no();

drop trigger if exists purchase_order_items_line_no on public.purchase_order_items;
create trigger purchase_order_items_line_no before insert on public.purchase_order_items
  for each row execute function public.set_purchase_order_item_line_no();
