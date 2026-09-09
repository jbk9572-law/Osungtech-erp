-- 보관 위치 코드를 "{랙 이름}-0{단}-0{좌우}"(예: A1-02-01) 형식에서 전체
-- 랙에 걸쳐 이어지는 순번(A1, A2, A3, A4, 다음 랙은 A5, A6, A7, A8 ...)
-- 으로 단순화한다. 랙이 만들어진 순서를 그대로 유지하고, 한 랙 안에서는
-- 2단 좌 → 2단 우 → 1단 좌 → 1단 우 순서로 번호를 매긴다.
--
-- location_stock_history.location_code는 그 시점의 코드를 그대로 남겨두는
-- 스냅샷이라 과거 이력의 표기는 바뀌지 않는다(의도된 동작) — locations.code
-- 자체만 바꾼다.
with ranked as (
  select
    id,
    row_number() over (
      order by
        min(created_at) over (partition by warehouse_id, rack),
        warehouse_id,
        rack,
        tier desc,
        position asc
    ) as seq
  from public.locations
)
update public.locations l
set code = 'A' || ranked.seq
from ranked
where l.id = ranked.id;
