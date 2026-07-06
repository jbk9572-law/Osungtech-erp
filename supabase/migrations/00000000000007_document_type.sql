-- 거래처별 발행 문서 유형 (출고증: 단가 없음 / 명세표: 단가 포함)
alter table public.customers
  add column if not exists document_type text not null default '명세표'
  check (document_type in ('출고증', '명세표'));

-- 회사 정보: 명세표/출고증 상단에 표시되는 팩스/담당자 정보
alter table public.company_profile
  add column if not exists fax_number text,
  add column if not exists manager_name text,
  add column if not exists manager_phone text;
