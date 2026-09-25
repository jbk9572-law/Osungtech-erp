-- 창고 생성 화면(재고관리 > 창고 관리)을 새로 만들면서 발견한 결함:
-- warehouses.name이 멀티테넌트 전환(migration 99) 이전부터 있던 전역
-- unique 제약이라, 테넌트 A가 "본사"라는 이름으로 창고를 만들면 테넌트
-- B는 같은 이름을 못 쓴다(서로 다른 회사인데 이름이 충돌). tenant_id
-- 컬럼은 이미 있으니, 유니크 범위를 테넌트(+demo) 단위로 좁힌다.
alter table public.warehouses drop constraint if exists warehouses_name_key;

create unique index if not exists warehouses_tenant_demo_name_idx
  on public.warehouses (tenant_id, is_demo, name);
