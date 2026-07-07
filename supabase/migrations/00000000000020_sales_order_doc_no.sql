-- 거래명세표(엔택스 B형) 원본에는 "No" 칸에 1부터 순차 증가하는 문서번호가
-- 찍히는데, 지금은 주문 id(uuid) 앞 8자리를 그냥 잘라 쓰고 있어 전혀
-- 엉뚱한 값이 나온다. sales_orders에 순번 컬럼을 추가하고, 기존 행은
-- 생성일 순서대로 1부터 채운 뒤, 이후로는 자동 증가하게 만든다.
create sequence if not exists public.sales_orders_doc_no_seq;

alter table public.sales_orders
  add column if not exists doc_no bigint;

do $$
declare
  r record;
  n bigint := 0;
begin
  for r in select id from public.sales_orders where doc_no is null order by created_at loop
    n := n + 1;
    update public.sales_orders set doc_no = n where id = r.id;
  end loop;
  perform setval('public.sales_orders_doc_no_seq', greatest(n, 1), n > 0);
end $$;

alter table public.sales_orders
  alter column doc_no set default nextval('public.sales_orders_doc_no_seq'),
  alter column doc_no set not null;

create unique index if not exists sales_orders_doc_no_key on public.sales_orders (doc_no);
