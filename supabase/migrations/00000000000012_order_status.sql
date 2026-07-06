-- 수주/발주 진행상태 컬럼 추가 (클래식 ERP UI의 상태 배지 표시용)
alter table public.sales_orders
  add column if not exists status text not null default 'completed';

alter table public.purchase_orders
  add column if not exists status text not null default 'completed';

do $$ begin
  alter table public.sales_orders
    add constraint sales_orders_status_check
    check (status in ('pending', 'processing', 'completed', 'cancelled'));
exception
  when duplicate_object then null;
end $$;

do $$ begin
  alter table public.purchase_orders
    add constraint purchase_orders_status_check
    check (status in ('pending', 'processing', 'completed', 'cancelled'));
exception
  when duplicate_object then null;
end $$;
