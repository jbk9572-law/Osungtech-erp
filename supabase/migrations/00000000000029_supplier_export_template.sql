-- 매입처마다 요구하는 엑셀 다운로드 양식이 다르므로, 공급업체별로 어떤
-- 템플릿을 쓸지와 금액 계산 기준(박스 단가 vs 수량 단가)을 저장한다.
alter table public.suppliers
  add column if not exists purchase_export_template text not null default 'generic'
  check (purchase_export_template in ('generic', 'standard_ledger', 'leaders_special'));

alter table public.suppliers
  add column if not exists purchase_price_basis text not null default 'quantity'
  check (purchase_price_basis in ('box', 'quantity'));

-- 표준 장부 양식(품명/규격/단위/박스/수량/단가/금액/비고) + 금액 = 단가×박스
update public.suppliers
set purchase_export_template = 'standard_ledger', purchase_price_basis = 'box'
where regexp_replace(name, '[㈜()주식회사\s]', '', 'g') in (
  '이온하이텍', 'PMC테크놀로지', '피에이치테크', '청호수지'
);

-- 표준 장부 양식 + 금액 = 단가×수량
update public.suppliers
set purchase_export_template = 'standard_ledger', purchase_price_basis = 'quantity'
where regexp_replace(name, '[㈜()주식회사\s]', '', 'g') in (
  '에스엔에스필텍', '본필타섬유산업', '다웅', '에이플랜트'
);

-- 리더스특수지: 원본 파일은 두 품목군을 나란히 두고 무게까지 추적하는 훨씬
-- 복잡한 자체 양식을 쓰지만, 우리 시스템엔 무게/품목군 구분 데이터가 없어
-- 그 부분은 그대로 재현할 수 없다. 일자/품명/규격/수량/단가/금액/비고로
-- 단순화한 표(금액 = 단가×수량)로 대신한다.
update public.suppliers
set purchase_export_template = 'leaders_special', purchase_price_basis = 'quantity'
where regexp_replace(name, '[㈜()주식회사\s]', '', 'g') = '리더스특수지';
