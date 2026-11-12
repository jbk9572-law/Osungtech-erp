-- 오늘의업무 "매입" 칸에 이미 재고인 품목에 거래처 이름이 붙는 문제 점검용(읽기 전용, 데이터를 바꾸지 않는다).
-- Supabase SQL Editor에 그대로 붙여 실행한다. 아래 '커버테이프'를 확인할 품목명 일부로 바꾼다.
-- 결과의 각 줄 = "이 매입 품목에서 이 매출로 이만큼 재고가 소진됐다"는 기록(fifo_consumptions).
-- day_gap(매출 전표날짜 - 매입 전표날짜)이 크면 옛 미연결 매출이 새 매입을 가로챈 잘못된 연결 후보다
-- (migration 230 이전에는 날짜 제한이 없었다. 230 이후에도 앞뒤 14일 이내는 연결된다).
select
  po.doc_no          as purchase_doc,
  po.purchase_date,
  p.name             as product,
  poi.spec,
  poi.quantity       as purchase_qty,
  poi.remaining_quantity,
  fc.consumed_quantity,
  so.doc_no          as sale_doc,
  so.order_date      as sale_date,
  (so.order_date - po.purchase_date) as day_gap,
  c.name             as customer,
  fc.created_at      as linked_at
from public.fifo_consumptions fc
join public.purchase_order_items poi on poi.id = fc.purchase_order_item_id
join public.purchase_orders po on po.id = poi.purchase_order_id
join public.products p on p.id = poi.product_id
join public.sales_order_items soi on soi.id = fc.sales_order_item_id
join public.sales_orders so on so.id = soi.sales_order_id
left join public.customers c on c.id = so.customer_id
where fc.consumed_by_type = 'sale'
  and p.name ilike '%커버테이프%'
  and po.purchase_date >= current_date - 7
order by po.purchase_date desc, po.doc_no, so.order_date;
