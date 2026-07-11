-- 매출처마다 실제로 쓰는 엑셀 명세표 양식이 있어서, 그 거래처로 다운로드할 때는
-- 우리 시스템의 일반 컬럼 나열 대신 이 양식대로(수신/발신/합계금액 한글표기/
-- 세액 수식까지) 셀을 그려서 내려준다. 업로드받은 실제 파일을 열어 확인한
-- 구조는 크게 3가지: 박스 단위가 있는 필터부품형, 박스 단위가 없는
-- 필터부품형(수량만), 무게로 계산하는 지류(종이)형.
alter table public.customers
  add column if not exists sales_export_template text not null default 'generic'
  check (sales_export_template in ('generic', 'filter_box', 'filter_no_box', 'paper_roll'));

-- 필터부품형(박스 있음): 일자/품명/규격/단위/박스/수량/단가/공급가액/세액/비고
update public.customers
set sales_export_template = 'filter_box'
where regexp_replace(name, '[㈜()주식회사\s]', '', 'g') in (
  '경덕탄소산업', '명진커넥터', '경인산업', '금호씨앤피', '가온피엠씨', '마루이엠',
  '신광', '신영금속', '베타바이오', '승산화학', '씨엠케미칼', '에스엔에스필텍',
  '에이치에스티', '에이플랜트', '유안컴퍼니', '케이이티솔루션', '코포스'
);

-- 필터부품형(박스 없음): 일자/품명/규격/단위/수량/단가/공급가액/세액/비고
update public.customers
set sales_export_template = 'filter_no_box'
where regexp_replace(name, '[㈜()주식회사\s]', '', 'g') in (
  '제니스테크', '에이티씨', '타이거일렉'
);

-- 지류(종이)형: 일자/품명/규격/롤수/수량/무게(Box)/무게(합산)/단가/금액/세액/비고
update public.customers
set sales_export_template = 'paper_roll'
where regexp_replace(name, '[㈜()주식회사\s]', '', 'g') in (
  '나영식테크', '지현테크', '거산테크', '대신테크놀로지', '신원테크', '트래닛', '필텍코리아'
);
