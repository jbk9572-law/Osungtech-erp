-- 품목의 "규격"과 "단위"를 분리한다.
-- 지금까지는 규격(예: wp(150))과 단위(Kg/Ea/L 등)가 구분 없이 하나의
-- unit 컬럼에 섞여 들어가고 있었다. spec 컬럼을 새로 추가해 규격을
-- 별도로 저장하고, unit은 실제 측정 단위(Kg/Ea/L 등)만 담도록 한다.
alter table public.products
  add column if not exists spec text;
