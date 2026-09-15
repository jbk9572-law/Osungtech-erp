-- 매출관리 화면 디자인 정비의 일부로, 사용자가 지적한 "세금계산서
-- 발행 대비가 전혀 안 되어 있다"는 문제를 좁게 고친다. 실제 회계
-- 연동(홈택스 API 등)은 아직 손대지 않고, 그 전 단계로 필요한
-- 분류 정보(과세구분/증빙유형)와 거래처 코드, 거래명세서 발행 여부만
-- 우선 기록할 수 있게 한다. 매입관리는 이번엔 스키마만 미러링해두고
-- 화면(폼/그리드)은 다음 단계에서 붙인다 — 나중에 다시 마이그레이션을
-- 만들지 않기 위한 선반영.

-- 거래처 코드 — 지금까지 customers/suppliers에 사람이 알아볼 코드가
-- 전혀 없어서(내부 uuid만 있음) 목록에 표시할 게 없었다. 등록 순서대로
-- 자동 채번한다.
create sequence if not exists public.customers_code_seq;
create sequence if not exists public.suppliers_code_seq;

alter table public.customers
  add column if not exists customer_code text;
alter table public.suppliers
  add column if not exists supplier_code text;

do $$
declare
  r record;
  n bigint := 0;
begin
  for r in select id from public.customers where customer_code is null order by created_at loop
    n := nextval('public.customers_code_seq');
    update public.customers set customer_code = 'C' || lpad(n::text, 5, '0') where id = r.id;
  end loop;
  perform setval('public.customers_code_seq', greatest(n, 1), n > 0);
end $$;

do $$
declare
  r record;
  n bigint := 0;
begin
  for r in select id from public.suppliers where supplier_code is null order by created_at loop
    n := nextval('public.suppliers_code_seq');
    update public.suppliers set supplier_code = 'S' || lpad(n::text, 5, '0') where id = r.id;
  end loop;
  perform setval('public.suppliers_code_seq', greatest(n, 1), n > 0);
end $$;

alter table public.customers
  alter column customer_code set default ('C' || lpad(nextval('public.customers_code_seq')::text, 5, '0')),
  alter column customer_code set not null;
alter table public.suppliers
  alter column supplier_code set default ('S' || lpad(nextval('public.suppliers_code_seq')::text, 5, '0')),
  alter column supplier_code set not null;

create unique index if not exists customers_customer_code_key on public.customers (customer_code);
create unique index if not exists suppliers_supplier_code_key on public.suppliers (supplier_code);

-- 과세구분 / 증빙유형 / 거래명세서 발행여부 — sales_orders에 우선 추가.
-- purchase_orders는 스키마만 같이 맞춰두고 화면은 다음 단계에서.
alter table public.sales_orders
  add column if not exists tax_type text not null default '과세'
    check (tax_type in ('과세', '면세', '영세')),
  add column if not exists evidence_type text
    check (evidence_type is null or evidence_type in ('세금계산서', '계산서', '현금영수증', '카드매출전표')),
  add column if not exists statement_issued_at timestamptz;

alter table public.purchase_orders
  add column if not exists tax_type text not null default '과세'
    check (tax_type in ('과세', '면세', '영세')),
  add column if not exists evidence_type text
    check (evidence_type is null or evidence_type in ('세금계산서', '계산서', '현금영수증', '카드매출전표')),
  add column if not exists statement_issued_at timestamptz;
