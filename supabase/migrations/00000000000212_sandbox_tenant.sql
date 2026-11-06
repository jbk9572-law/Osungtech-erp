-- 테스트 샌드박스 환경 1단계: 전용 테넌트 안전장치 + 원클릭 리셋/시드
-- (사용자 기획안 "개발·테스트 샌드박스 최종 아키텍처"의 1~2번 — 스냅샷/
-- 목업 API/타임머신/디버그 드로어는 다음 단계로 미룸).
--
-- 플랫폼관리자가 특정 테넌트에 is_sandbox=true를 지정해두면, 그 테넌트에
-- 로그인한 관리자가 직접 "초기화"/"더미 데이터 생성"을 누를 수 있다 —
-- 두 작업 모두 is_sandbox_tenant()로 "지금 내 테넌트가 정말 샌드박스로
-- 지정된 테넌트인가"를 먼저 확인하므로, 실수로라도 실제 운영 테넌트의
-- 데이터를 지우는 경로 자체가 없다(함수가 항상 current_tenant_id() —
-- 호출자 본인의 테넌트 — 기준으로만 동작하고, 그 테넌트가 샌드박스가
-- 아니면 둘 다 그 자리에서 예외를 던지고 아무것도 안 건드린다).

alter table public.tenants add column if not exists is_sandbox boolean not null default false;

create or replace function public.is_sandbox_tenant()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select is_sandbox from public.tenants where id = public.current_tenant_id()), false);
$$;

revoke all on function public.is_sandbox_tenant() from public;
grant execute on function public.is_sandbox_tenant() to authenticated;

create or replace function public.set_tenant_sandbox(p_tenant_id uuid, p_is_sandbox boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception '플랫폼 운영자만 변경할 수 있습니다.';
  end if;
  update public.tenants set is_sandbox = p_is_sandbox where id = p_tenant_id;
end;
$$;

revoke all on function public.set_tenant_sandbox(uuid, boolean) from public;
grant execute on function public.set_tenant_sandbox(uuid, boolean) to authenticated;

-- tenant_id 컬럼을 가진 테이블 전부에서 "지금 로그인한 샌드박스 테넌트"
-- 행만 지운다. 대부분은 FK cascade로 한 번에 끝나지만(migration 99부터
-- 일관된 on delete cascade 컨벤션), 혹시 순서상 먼저 걸리는 테이블이
-- 있으면 외래키 위반만 건너뛰고 여러 패스를 돌며 재시도한다 — 90개가
-- 넘는 테이블을 전부 손으로 나열하며 순서를 맞추는 대신, 있는 그대로
-- 안전하게 훑는 방식을 택했다. profiles/tenant_members(로그인 계정 자체)
-- 는 리셋 대상에서 뺀다 — 안 빼면 방금 리셋을 누른 본인 계정까지
-- 같이 지워져서 그 즉시 로그인이 끊긴다.
create or replace function public.sandbox_reset()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid := public.current_tenant_id();
  v_tbl record;
  v_pass int;
  v_remaining int := 0;
  v_prev_remaining int := -1;
  v_exclude text[] := array['profiles', 'tenant_members'];
begin
  if not public.is_admin() then
    raise exception '관리자만 실행할 수 있습니다.';
  end if;
  if not public.is_sandbox_tenant() then
    raise exception '샌드박스로 지정된 테넌트에서만 실행할 수 있습니다.';
  end if;

  for v_pass in 1..5 loop
    v_remaining := 0;
    for v_tbl in
      select c.table_name from information_schema.columns c
      where c.table_schema = 'public' and c.column_name = 'tenant_id'
        and c.table_name <> all(v_exclude)
    loop
      begin
        execute format('delete from public.%I where tenant_id = $1', v_tbl.table_name) using v_tenant_id;
      exception when foreign_key_violation then
        v_remaining := v_remaining + 1;
      end;
    end loop;
    exit when v_remaining = 0 or v_remaining = v_prev_remaining;
    v_prev_remaining := v_remaining;
  end loop;

  if v_remaining > 0 then
    raise exception '일부 테이블(%개)을 정리하지 못했습니다 — 참조 구조를 다시 확인해주세요.', v_remaining;
  end if;
end;
$$;

revoke all on function public.sandbox_reset() from public;
grant execute on function public.sandbox_reset() to authenticated;

-- 품목 등록 → 매입 입고 → 재고 증가 → 매출 출고 → 재고 차감까지 실제
-- RPC(create_purchase_with_items/create_sale_with_items)를 그대로 호출해
-- 채운다 — raw insert로 손으로 흉내내지 않는 이유는, 그러면 그 두 RPC가
-- 안에서 하는 일(FIFO 레이어 적립/소진, inventory_transactions 기록,
-- 문서번호 채번 등)을 전부 다시 베껴야 하고 둘 중 하나가 나중에 바뀌면
-- 이 시드 함수만 조용히 안 맞게 되기 때문이다. 품목 중 일부만 출고해서
-- (전량이 아니라) 재고현황과 FIFO 잔량 둘 다 의미 있게 남도록 한다.
-- 반품/샘플/대여 등 더 다양한 시나리오는 다음 단계로 미룬다.
create or replace function public.sandbox_seed()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_warehouse_id uuid;
  v_supplier_id uuid;
  v_customer_id uuid;
  v_product_a uuid;
  v_product_b uuid;
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

  insert into public.suppliers (name, contact_name) values ('샌드박스 매입처', '김매입')
  returning id into v_supplier_id;

  insert into public.customers (name, contact_name) values ('샌드박스 거래처', '박매출')
  returning id into v_customer_id;

  insert into public.products (sku, name, unit, price, cost, reorder_point)
  values ('SB-001', '샌드박스 테스트품목 A', 'EA', 15000, 10000, 20)
  returning id into v_product_a;

  insert into public.products (sku, name, unit, price, cost, reorder_point)
  values ('SB-002', '샌드박스 테스트품목 B', 'BOX', 48000, 32000, 10)
  returning id into v_product_b;

  perform public.create_purchase_with_items(
    v_supplier_id, v_warehouse_id, current_date - 7, '샌드박스 초기 매입', v_actor,
    jsonb_build_array(
      jsonb_build_object('productId', v_product_a, 'quantity', 100, 'unitCost', 10000),
      jsonb_build_object('productId', v_product_b, 'quantity', 50, 'unitCost', 32000)
    )
  );

  perform public.create_sale_with_items(
    v_customer_id, v_warehouse_id, current_date - 2, '샌드박스 초기 매출', v_actor,
    jsonb_build_array(
      jsonb_build_object('productId', v_product_a, 'quantity', 30, 'unitPrice', 15000),
      jsonb_build_object('productId', v_product_b, 'quantity', 15, 'unitPrice', 48000)
    )
  );
end;
$$;

revoke all on function public.sandbox_seed() from public;
grant execute on function public.sandbox_seed() to authenticated;
