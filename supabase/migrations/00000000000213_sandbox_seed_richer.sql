-- sandbox_seed()가 매입 1건+매출 1건만 만들어서 "실제 환경처럼" 보기엔
-- 너무 적다는 피드백(사용자: "겨우 2건 생성되네? 너무적게생성되는거
-- 아니야 실제 환경을보려는건데") — 거래처/공급처/품목 수와 매입·매출
-- 건수를 훨씬 늘린다. 품목명은 이 업종(지류/포장재) 느낌이 나게
-- 실제 화면에서 봐온 품목명 패턴(크라프트지/아트지/모조지/띠지/필터
-- 등)을 그대로 따른다 — 완전 무작위 영문 placeholder보다 실무자가
-- 보기에 훨씬 자연스럽다.
create or replace function public.sandbox_seed()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_warehouse_id uuid;
  v_tmp_id uuid;
  v_supplier_ids uuid[] := '{}';
  v_customer_ids uuid[] := '{}';
  v_product_ids uuid[] := '{}';
  v_product_names text[] := array[
    '크라프트지95', '크라프트지120', '아트지150', '모조지80', '모조지100',
    '무진지', '띠지25mm', '띠지34mm', '커버테이프', '백(100)',
    '백(150)', '필터125mm', '필터150mm', 'OPP테이프', '완충재'
  ];
  v_product_units text[] := array[
    'EA', 'EA', 'EA', 'EA', 'EA', 'EA', 'ROLL', 'ROLL', 'ROLL', 'EA', 'EA', 'EA', 'EA', 'ROLL', 'EA'
  ];
  i int;
  j int;
  v_cost numeric;
  v_price numeric;
  v_pick int;
  v_qty numeric;
  v_order_date date;
  v_items jsonb;
  v_item_count int;
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;
  if not public.is_admin() then
    raise exception '관리자만 실행할 수 있습니다.';
  end if;
  if not public.is_sandbox_tenant() then
    raise exception '샌드박스로 지정된 테넌트에서만 실행할 수 있습니다.';
  end if;

  insert into public.warehouses (name, location) values ('샌드박스 본사창고', '테스트용')
  returning id into v_warehouse_id;

  for i in 1..5 loop
    insert into public.suppliers (name, contact_name) values ('샌드박스 매입처' || i, '담당자' || i)
    returning id into v_tmp_id;
    v_supplier_ids := v_supplier_ids || v_tmp_id;
  end loop;

  for i in 1..8 loop
    insert into public.customers (name, contact_name) values ('샌드박스 거래처' || i, '담당자' || i)
    returning id into v_tmp_id;
    v_customer_ids := v_customer_ids || v_tmp_id;
  end loop;

  for i in 1..array_length(v_product_names, 1) loop
    v_cost := (20 + floor(random() * 80)) * 100;
    v_price := round(v_cost * (1.3::numeric + random()::numeric * 0.4::numeric));
    insert into public.products (sku, name, unit, price, cost, reorder_point)
    values (
      'SB-' || lpad(i::text, 3, '0'), v_product_names[i], v_product_units[i],
      v_price, v_cost, (20 + floor(random() * 30))::int
    )
    returning id into v_tmp_id;
    v_product_ids := v_product_ids || v_tmp_id;
  end loop;

  -- 매입 15건 — 최근 45일에 걸쳐, 건마다 품목 1~3개
  for i in 1..15 loop
    v_order_date := current_date - floor(random() * 45)::int;
    v_item_count := 1 + floor(random() * 3)::int;
    v_items := '[]'::jsonb;
    for j in 1..v_item_count loop
      v_pick := 1 + floor(random() * array_length(v_product_ids, 1))::int;
      v_qty := 50 + floor(random() * 400);
      v_items := v_items || jsonb_build_array(jsonb_build_object(
        'productId', v_product_ids[v_pick],
        'quantity', v_qty,
        'unitCost', (select cost from public.products where id = v_product_ids[v_pick])
      ));
    end loop;
    perform public.create_purchase_with_items(
      v_supplier_ids[1 + floor(random() * array_length(v_supplier_ids, 1))::int],
      v_warehouse_id, v_order_date, '샌드박스 더미 매입 ' || i, v_actor, v_items
    );
  end loop;

  -- 매출 30건 — 최근 40일에 걸쳐, 건마다 품목 1~3개
  for i in 1..30 loop
    v_order_date := current_date - floor(random() * 40)::int;
    v_item_count := 1 + floor(random() * 3)::int;
    v_items := '[]'::jsonb;
    for j in 1..v_item_count loop
      v_pick := 1 + floor(random() * array_length(v_product_ids, 1))::int;
      v_qty := 10 + floor(random() * 150);
      v_items := v_items || jsonb_build_array(jsonb_build_object(
        'productId', v_product_ids[v_pick],
        'quantity', v_qty,
        'unitPrice', (select price from public.products where id = v_product_ids[v_pick])
      ));
    end loop;
    perform public.create_sale_with_items(
      v_customer_ids[1 + floor(random() * array_length(v_customer_ids, 1))::int],
      v_warehouse_id, v_order_date, '샌드박스 더미 매출 ' || i, v_actor, v_items
    );
  end loop;
end;
$$;

revoke all on function public.sandbox_seed() from public;
grant execute on function public.sandbox_seed() to authenticated;
