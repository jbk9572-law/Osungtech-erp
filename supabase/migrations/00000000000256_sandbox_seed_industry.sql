-- 업종별 예시 데이터(샌드박스 전용). 기본 더미데이터(종이 제조·유통 모양)에 더해, 다른 업종에서 흔한 "모양"을 작게 얹는다.
--   food    : 소수 수량·소수 단가(kg/L), 매입→출고, 반품 1건          (범용성 점검 ① ③)
--   retail  : 소량 다품목 출고가 잦고 반품이 여러 건                    (③)
--   service : 품목 없이 이름만 적는 줄(용역·월정액), 재고를 쓰지 않음   (② ④)
-- 기본 더미데이터(창고·거래처·매입처)가 먼저 있어야 한다. 같은 업종을 두 번 누르면 "이미 만들었습니다"로 거절(중복 방지).
-- 샌드박스로 지정된 회사 + 관리자만 실행할 수 있다(기본 더미 생성 함수와 같은 안전장치).
create or replace function public.sandbox_seed_industry(p_industry text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_tenant uuid := public.current_tenant_id();
  v_warehouse uuid;
  v_customer uuid;
  v_supplier uuid;
  v_prefix text;
  v_pid uuid[] := '{}';
  v_id uuid;
  v_i int;
  v_names text[];
  v_units text[];
  v_prices numeric[];
  v_costs numeric[];
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
  if p_industry not in ('food', 'retail', 'service') then
    raise exception '알 수 없는 업종입니다.';
  end if;

  select id into v_warehouse from public.warehouses where tenant_id = v_tenant and name = '샌드박스 본사창고' order by created_at limit 1;
  select id into v_customer from public.customers where tenant_id = v_tenant and name = '샌드박스 거래처1' limit 1;
  select id into v_supplier from public.suppliers where tenant_id = v_tenant and name = '샌드박스 매입처1' limit 1;
  if v_warehouse is null or v_customer is null or v_supplier is null then
    raise exception '먼저 기본 더미데이터를 만들어 주세요(창고·거래처·매입처가 필요합니다).';
  end if;

  v_prefix := 'IND-' || upper(p_industry) || '-';
  if exists (select 1 from public.products where tenant_id = v_tenant and sku like v_prefix || '%')
     or (p_industry = 'service' and exists (
       select 1 from public.sales_orders where tenant_id = v_tenant and memo = '샌드박스 서비스업 예시 매출 1')) then
    raise exception '이미 만든 업종 예시입니다.';
  end if;

  if p_industry in ('food', 'retail') then
    if p_industry = 'food' then
      v_names := array['쌀(백미)', '식용유', '설탕', '간장', '소금'];
      v_units := array['KG', 'L', 'KG', 'L', 'KG'];
      v_prices := array[3250.5, 4890.25, 1980.75, 3520, 1250.5];
      v_costs := array[2700.25, 4100.5, 1500.1, 2800, 900.75];
    else
      v_names := array['볼펜(흑)', '노트(A5)', '텀블러', '에코백', '파우치'];
      v_units := array['EA', 'EA', 'EA', 'EA', 'EA'];
      v_prices := array[1500, 3200, 12900, 8900, 6500];
      v_costs := array[700, 1800, 7400, 4800, 3300];
    end if;

    for v_i in 1..array_length(v_names, 1) loop
      insert into public.products (sku, name, unit, price, cost, reorder_point)
      values (v_prefix || lpad(v_i::text, 3, '0'), v_names[v_i], v_units[v_i], v_prices[v_i], v_costs[v_i], 0)
      returning id into v_id;
      v_pid := v_pid || v_id;
    end loop;

    -- 매입(입고) → 출고: food 는 소수 수량, retail 은 정수 소량.
    for v_i in 1..array_length(v_pid, 1) loop
      perform public.create_purchase_with_items(
        v_supplier, v_warehouse, current_date - 20, '샌드박스 ' || p_industry || ' 예시 매입 ' || v_i, v_actor,
        jsonb_build_array(jsonb_build_object(
          'productId', v_pid[v_i],
          'quantity', case when p_industry = 'food' then 120.5 + v_i * 10.25 else 200 end,
          'unitCost', v_costs[v_i]))
      );
    end loop;

    for v_i in 1..array_length(v_pid, 1) loop
      perform public.create_sale_with_items(
        p_customer_id := v_customer, p_warehouse_id := v_warehouse, p_order_date := current_date - 10 + v_i,
        p_memo := '샌드박스 ' || p_industry || ' 예시 매출 ' || v_i, p_created_by := v_actor,
        p_items := jsonb_build_array(jsonb_build_object(
          'productId', v_pid[v_i],
          'quantity', case when p_industry = 'food' then 7.75 + v_i * 0.5 else 3 + v_i end,
          'unitPrice', v_prices[v_i]))
      );
    end loop;

    -- 반품: food 1건, retail 3건(소매는 반품이 잦다).
    for v_i in 1..(case when p_industry = 'food' then 1 else 3 end) loop
      perform public.create_sale_with_items(
        p_customer_id := v_customer, p_warehouse_id := v_warehouse, p_order_date := current_date - 2,
        p_memo := '샌드박스 ' || p_industry || ' 예시 반품 ' || v_i, p_created_by := v_actor,
        p_items := jsonb_build_array(jsonb_build_object(
          'productId', v_pid[v_i],
          'quantity', case when p_industry = 'food' then 1.25 else 1 end,
          'unitPrice', v_prices[v_i])),
        p_is_return := true, p_return_reason := '고객 변심'
      );
    end loop;
  else
    -- 서비스업: 품목 없이 이름만 적는 줄. 재고를 쓰지 않는다.
    for v_i in 1..4 loop
      perform public.create_sale_with_items(
        p_customer_id := v_customer, p_warehouse_id := v_warehouse, p_order_date := current_date - 25 + v_i * 5,
        p_memo := '샌드박스 서비스업 예시 매출 ' || v_i, p_created_by := v_actor,
        p_items := jsonb_build_array(
          jsonb_build_object('customName', '컨설팅 용역(' || v_i || '월차)', 'quantity', 1, 'unitPrice', 1500000 + v_i * 100000),
          jsonb_build_object('customName', '유지보수 월정액', 'quantity', 1, 'unitPrice', 300000))
      );
    end loop;
    for v_i in 1..2 loop
      perform public.create_purchase_with_items(
        v_supplier, v_warehouse, current_date - 15 + v_i * 5, '샌드박스 서비스업 예시 매입 ' || v_i, v_actor,
        jsonb_build_array(jsonb_build_object('customName', '외주 개발비', 'quantity', 1, 'unitCost', 800000 * v_i))
      );
    end loop;
  end if;

  return case p_industry when 'food' then '식품' when 'retail' then '소매' else '서비스' end || '업 예시 데이터를 만들었습니다.';
end;
$$;
revoke all on function public.sandbox_seed_industry(text) from public;
grant execute on function public.sandbox_seed_industry(text) to authenticated;
