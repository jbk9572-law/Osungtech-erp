-- 이전 마이그레이션(00000000000030)의 이름 매칭 정규식이 잘못됐었다.
-- `[㈜()주식회사\s]`는 문자 클래스라서 "주식회사"를 통째로 지우는 게 아니라
-- 주/식/회/사 낱글자를 각각 지워버린다. 그래서 이름에 "식"자가 들어있는
-- "나영식테크"가 "나영테크"로 깎여서 매칭에 실패했다(다른 26개 거래처는
-- 우연히 이 글자들과 안 겹쳐서 문제없이 걸렸다). "주식회사"를 하나의
-- 문자열로 취급하도록 교체헤서 다시 채운다.
update public.customers
set sales_export_template = 'filter_box'
where regexp_replace(name, '㈜|\(|\)|주식회사|\s', '', 'g') in (
  '경덕탄소산업', '명진커넥터', '경인산업', '금호씨앤피', '가온피엠씨', '마루이엠',
  '신광', '신영금속', '베타바이오', '승산화학', '씨엠케미칼', '에스엔에스필텍',
  '에이치에스티', '에이플랜트', '유안컴퍼니', '케이이티솔루션', '코포스'
);

update public.customers
set sales_export_template = 'filter_no_box'
where regexp_replace(name, '㈜|\(|\)|주식회사|\s', '', 'g') in (
  '제니스테크', '에이티씨', '타이거일렉'
);

update public.customers
set sales_export_template = 'paper_roll'
where regexp_replace(name, '㈜|\(|\)|주식회사|\s', '', 'g') in (
  '나영식테크', '지현테크', '거산테크', '대신테크놀로지', '신원테크', '트래닛', '필텍코리아'
);
