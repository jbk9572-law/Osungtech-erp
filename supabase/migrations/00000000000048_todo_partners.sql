-- 할일은 결국 매입/매출의 예비 전표라서, 거래처도 할일 단계에서 미리
-- 골라둘 수 있어야 한다. 유형별로: 매입 → supplier_id, 매출 → customer_id,
-- 매입+출고 → 둘 다. "할일 가져오기"가 제목 문자열로 거래처를 추측하는
-- 대신 이 id를 그대로 써서 확정적으로 채운다.
alter table public.todos
  add column if not exists supplier_id uuid references public.suppliers (id) on delete set null,
  add column if not exists customer_id uuid references public.customers (id) on delete set null;
