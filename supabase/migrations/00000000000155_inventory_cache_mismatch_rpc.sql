-- 재고실사(/inventory/count) 화면의 "재고 캐시 정합성 검증"(?verify=1)
-- 버튼이 전체 inventory_transactions를 필터 없이 fetchAllRows로 Worker까지
-- 통째로 끌어와 JS에서 다시 합산했다 — 그 파일에 이미 남아있는 주석대로
-- 이 패턴(회사 전체·전체 기간 거래이력을 필터 없이 훑는 쿼리)이 예전에
-- 한 번 "Worker exceeded resource limits"로 사이트 전체가 죽는 사고를 낸
-- 전례가 있어 자동 실행은 막아뒀지만, 버튼을 누르면 여전히 그 무거운
-- 쿼리가 그대로 실행됐다 — 거래가 많이 쌓인 테넌트일수록 버튼을 누르는
-- 순간 같은 사고가 재현될 수 있는 상태로 남아 있었다.
--
-- get_customer_balances()/get_supplier_balances()(migration 90/120)가
-- 이미 "미수금/미지급금 합계를 앱 서버로 전부 내려받아 더하던 걸 SQL
-- 집계로 옮긴" 같은 종류의 문제를 고친 전례라 같은 방식을 따른다 — 합산
-- 자체를 DB 안에서 끝내고, 불일치가 있는 품목 행만 돌려받는다. numeric
-- 타입끼리 DB 안에서 그대로 비교하므로(JS로 다시 더할 때 생기던 부동소수점
-- 오차가 없다) 기존 코드의 EPSILON 허용오차도 더는 필요 없다.
create or replace function public.get_inventory_cache_mismatches()
returns table (
  product_id uuid,
  sku text,
  name text,
  spec text,
  cached numeric,
  computed numeric
)
language sql
security definer
set search_path = public
as $$
  select
    p.id as product_id,
    p.sku,
    p.name,
    p.spec,
    coalesce(inv.cached, 0) as cached,
    coalesce(tx.computed, 0) as computed
  from public.products p
  left join (
    select product_id, sum(quantity) as cached
    from public.inventory
    where is_demo = public.is_demo_actor()
      and tenant_id = public.current_tenant_id()
    group by product_id
  ) inv on inv.product_id = p.id
  left join (
    select
      product_id,
      sum(case when type = 'out' then -abs(quantity) else quantity end) as computed
    from public.inventory_transactions
    where is_demo = public.is_demo_actor()
      and tenant_id = public.current_tenant_id()
    group by product_id
  ) tx on tx.product_id = p.id
  where p.is_demo = public.is_demo_actor()
    and p.tenant_id = public.current_tenant_id()
    and coalesce(inv.cached, 0) <> coalesce(tx.computed, 0);
$$;
