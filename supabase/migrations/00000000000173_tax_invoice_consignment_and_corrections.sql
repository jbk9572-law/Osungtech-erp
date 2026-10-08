-- 세금계산서 종류 확장(위수탁/위수탁영세) + 수정세금계산서.
--
-- 지금까지는 일반/영세율 2종류만 지원했는데, 홈택스 화면 기준으로
-- 위수탁/위수탁영세, 그리고 이미 발행한 세금계산서를 고치는 수정세금계산서도
-- 필요하다. 00000000000172_tax_invoices.sql이 먼저 적용돼 있어야 한다.

-- 1) 종류 확장 — 위수탁 거래는 수탁자(실제 발급 작업을 대신하는 쪽)가
--    공급자/공급받는자와 별도로 필요해서 수탁자 정보 칼럼을 추가한다.
--    거래처 테이블에 없는 임의의 상대방일 수 있어 자유 입력 텍스트로 둔다
--    (customers/suppliers처럼 거래가 반복되는 대상이 아니라 매번 다를 수 있음).
alter table public.tax_invoices drop constraint if exists tax_invoices_invoice_type_check;
alter table public.tax_invoices add constraint tax_invoices_invoice_type_check
  check (invoice_type in ('general', 'zero_rate', 'consignment', 'consignment_zero_rate'));

alter table public.tax_invoices add column if not exists consignee_name text;
alter table public.tax_invoices add column if not exists consignee_business_number text;
alter table public.tax_invoices add column if not exists consignee_representative_name text;

-- 2) 수정세금계산서 — 당초 세금계산서를 가리키는 자기참조 + 수정사유.
--    원본/수정분을 구분할 original_invoice_id 컬럼을 먼저 만들어야 그걸
--    가리키는 부분 유니크 인덱스(바로 아래)를 걸 수 있다 — 순서 중요.
alter table public.tax_invoices add column if not exists original_invoice_id uuid references public.tax_invoices (id) on delete cascade;
-- 부가가치세법 시행령 제70조 기준 수정 사유. duplicate_issued(착오에 의한
-- 이중발급)는 엄밀히는 error_correction의 특수 케이스지만, 전체 금액을
-- 마이너스로 수정하는 흐름이 확연히 달라 실무 관행대로 별도 사유로 둔다.
alter table public.tax_invoices add column if not exists modification_reason text
  check (modification_reason in (
    'error_correction', 'duplicate_issued', 'supply_amount_change',
    'contract_cancelled', 'goods_returned', 'export_lc_after'
  ));

-- 기존엔 sales_order_id가 unique(매출 건당 세금계산서 1장)였는데, 수정발행을
-- 허용하면 같은 매출 건에 "원본 1장 + 수정분 N장"이 쌓일 수 있다. unique
-- 제약을 풀고, 대신 "원본(= original_invoice_id is null)은 매출 건당 최대
-- 1장"이라는 더 약한 제약을 부분 유니크 인덱스로 건다 — 수정분은 원본처럼
-- sales_order_id가 겹쳐도 된다.
alter table public.tax_invoices drop constraint if exists tax_invoices_sales_order_id_key;
create unique index if not exists tax_invoices_one_original_per_order_idx
  on public.tax_invoices (sales_order_id)
  where original_invoice_id is null;

create index if not exists tax_invoices_original_invoice_id_idx on public.tax_invoices (original_invoice_id);
