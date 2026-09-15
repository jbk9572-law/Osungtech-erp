-- 수불부(품목별 입출고 대장) 1차 범위.
--
-- 새 테이블은 필요 없다 — 이미 있는 inventory_transactions가 곧 입출고
-- 원장이라, 여기서는 "특정 기준일 이전 누적 재고(이월)"를 구하는 RPC
-- 하나만 추가한다. 이 합계를 화면(Node) 쪽에서 그 품목의 전체 이력을
-- 통째로 끌어와 더하는 방식으로 구하면, 거래가 많이 쌓인 인기 품목일수록
-- 조회할 때마다 계속 커지는 풀스캔이 된다 — 이번 세션 초반 재고실사
-- 페이지 CPU 초과 사고와 같은 종류의 함정이라, 처음부터 Postgres SUM
-- 집계 함수로 DB 안에서 끝낸다.
create or replace function public.get_ledger_opening_balance(
  p_product_id uuid,
  p_warehouse_id uuid default null,
  p_before timestamptz default now()
)
returns numeric
language sql
stable
as $$
  select coalesce(sum(
    case
      when type = 'out' then -abs(quantity)
      else quantity
    end
  ), 0)
  from public.inventory_transactions
  where product_id = p_product_id
    and (p_warehouse_id is null or warehouse_id = p_warehouse_id)
    and created_at < p_before;
$$;

-- security definer가 아니다 — 호출자 권한 그대로 실행되어 RLS(is_demo/
-- tenant_id 격리)가 함수 안에서도 그대로 적용된다.
revoke all on function public.get_ledger_opening_balance(uuid, uuid, timestamptz) from public;
grant execute on function public.get_ledger_opening_balance(uuid, uuid, timestamptz) to authenticated;
