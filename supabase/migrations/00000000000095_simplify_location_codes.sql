-- 보관 위치 코드를 "{랙 이름}-0{단}-0{좌우}"(예: A1-02-01) 형식에서 전체
-- 랙에 걸쳐 이어지는 순번(A1, A2, A3, A4, 다음 랙은 A5, A6, A7, A8 ...)
-- 으로 단순화한다. 랙이 만들어진 순서를 그대로 유지하고, 한 랙 안에서는
-- 2단 좌 → 2단 우 → 1단 좌 → 1단 우 순서로 번호를 매긴다.
--
-- location_stock_history.location_code는 그 시점의 코드를 그대로 남겨두는
-- 스냅샷이라 과거 이력의 표기는 바뀌지 않는다(의도된 동작) — locations.code
-- 자체만 바꾼다.
with rack_times as (
  -- 윈도우 함수(min() over)를 row_number()의 order by 안에 그대로 중첩할
  -- 수 없어서(Postgres 42P20 에러), 랙별 최초 생성 시각을 먼저 일반
  -- 컬럼으로 뽑아두는 단계를 분리했다.
  select
    id,
    warehouse_id,
    rack,
    tier,
    position,
    min(created_at) over (partition by warehouse_id, rack) as rack_created_at
  from public.locations
),
ranked as (
  select
    id,
    row_number() over (
      order by rack_created_at, warehouse_id, rack, tier desc, position asc
    ) as seq
  from rack_times
)
update public.locations l
set code = 'A' || ranked.seq
from ranked
where l.id = ranked.id;
