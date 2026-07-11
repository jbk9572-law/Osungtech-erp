-- 확장모듈(모조지 계산) 결과를 판매주문(출고 건)에 연결해서 저장한다.
-- 지금까지는 계산기가 완전히 독립된 화면이라 계산 결과가 어디에도 남지
-- 않았고, 그래서 실무자가 "이 출고 건에 원지가 몇 연 나갔는지"를 확인할
-- 방법이 없었다. sales_order_id는 null을 허용한다: 주문과 무관하게
-- 견적/시험 삼아 계산기만 쓰는 기존 사용법도 그대로 유지하기 위함이고,
-- 주문이 삭제되더라도 계산 이력 자체는 남기고 연결만 끊는다.
create table if not exists public.paper_calculations (
  id uuid primary key default gen_random_uuid(),
  sales_order_id uuid references public.sales_orders (id) on delete set null,
  paper_w numeric not null,
  paper_h numeric not null,
  input_items jsonb not null,
  total_paper integer not null,
  total_sheet integer not null,
  total_prod integer not null,
  over_prod integer not null,
  fulfilled boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists paper_calculations_sales_order_id_idx
  on public.paper_calculations (sales_order_id);

alter table public.paper_calculations enable row level security;

do $$ begin
  create policy "paper_calculations_select_authenticated" on public.paper_calculations
    for select using (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "paper_calculations_insert_authenticated" on public.paper_calculations
    for insert with check (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "paper_calculations_delete_authenticated" on public.paper_calculations
    for delete using (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;
