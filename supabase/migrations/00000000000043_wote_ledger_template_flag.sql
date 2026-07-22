-- WOTE(매입처)↔신일베스텍(매출처) 원자재 입출고 관리대장은 지금까지
-- 코드에서 거래처 "이름 문자열"을 직접 비교해서 판별했다(wote-ledger-query.ts).
-- 다른 전용 서식들(leaders_special, filter_no_box 등)은 전부
-- suppliers.purchase_export_template / customers.sales_export_template
-- 플래그 컬럼으로 판별하는데 이 건만 예외였고, 거래처 이름이 바뀌면
-- 조용히 매칭이 깨지는 문제가 있었다. 같은 플래그 방식으로 통일한다.
alter table public.suppliers
  drop constraint if exists suppliers_purchase_export_template_check;
alter table public.suppliers
  add constraint suppliers_purchase_export_template_check
  check (purchase_export_template in ('generic', 'standard_ledger', 'leaders_special', 'wote_ledger'));

alter table public.customers
  drop constraint if exists customers_sales_export_template_check;
alter table public.customers
  add constraint customers_sales_export_template_check
  check (sales_export_template in ('generic', 'filter_box', 'filter_no_box', 'paper_roll', 'wote_ledger'));

update public.suppliers
set purchase_export_template = 'wote_ledger'
where regexp_replace(name, '㈜|\(|\)|주식회사|\s', '', 'g') ilike 'wote';

update public.customers
set sales_export_template = 'wote_ledger'
where regexp_replace(name, '㈜|\(|\)|주식회사|\s', '', 'g') = '신일베스텍';
