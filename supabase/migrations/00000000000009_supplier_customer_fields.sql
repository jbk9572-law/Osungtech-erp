-- 공급처(suppliers)에 거래처(customers)와 동일한 필드 추가: 사업자번호, 대표자명, 비고
alter table public.suppliers
  add column if not exists business_number text,
  add column if not exists representative_name text,
  add column if not exists notes text;

-- 거래처(customers)에도 비고 추가
alter table public.customers
  add column if not exists notes text;
