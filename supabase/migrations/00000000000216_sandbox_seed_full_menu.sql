-- "더미생성할때 모든걸 다 생성해줘야지 일부만 하면안되 메뉴에잇는 모든거
-- 사원 메일 메신저 게시판 입고 출고 재고 반품 수금 등" — 지금까지는
-- 매입/매출(+그로부터 파생되는 재고)만 채워졌다. 조직도(부서)/게시판
-- (공지사항)/반품/수금/사내메신저까지 같이 채운다.
--
-- 메일은 일부러 뺀다 — mail_accounts/mail_messages는 실제 외부
-- IMAP/SMTP 계정(암호화된 앱 비밀번호 포함, migration 127)을 동기화해
-- 캐시한 것이라, 가짜로 끼워 넣으면 복호화/동기화가 실패하는 깨진
-- 계정이 남는다. 더미로 채울 수 있는 성격의 데이터가 아니다.
--
-- "사원"은 이 함수(SQL) 혼자서는 못 만든다 — profiles.id는 auth.users를
-- 참조해야 해서 실제 로그인 계정(service_role 권한, auth.admin.createUser)이
-- 있어야 한다. 그래서 부서/사원 "계정" 생성은 settings/sandbox/actions.ts
-- (TS, service_role 클라이언트)가 이 함수 호출 뒤에 이어서 한다 — 여기서는
-- 부서(조직도)까지만 만들어 둔다.
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
  v_dept_names text[] := array['영업부', '구매부', '경영지원부'];
  v_product_names text[] := array[
    '크라프트지95', '크라프트지120', '아트지150', '모조지80', '모조지100',
    '무진지', '띠지25mm', '띠지34mm', '커버테이프', '백(100)',
    '백(150)', '필터125mm', '필터150mm', 'OPP테이프', '완충재'
  ];
  v_product_units text[] := array[
    'EA', 'EA', 'EA', 'EA', 'EA', 'EA', 'ROLL', 'ROLL', 'ROLL', 'EA', 'EA', 'EA', 'EA', 'ROLL', 'EA'
  ];
  v_announcement_titles text[] := array[
    '11월 정기 재고 실사 안내', '매입 전표 등록 시 로트번호 필수 입력 안내',
    '사내 메신저 "전체" 채널 이용 안내', '거래처 담당자 변경 공지'
  ];
  v_announcement_bodies text[] := array[
    '11월 넷째 주 중 창고별 재고 실사를 진행합니다. 담당 창고는 사전에 QR 자동실사로 수량을 미리 확인해주세요.',
    '매입 등록 시 로트번호를 비워두면 추후 재고 조회가 어렵습니다. 입고관리 > 품목 등록 시 꼭 기재 부탁드립니다.',
    '사내메신저 "전체" 채널은 공지/긴급 전달용입니다. 개별 업무 논의는 담당자와 직접 메시지로 부탁드립니다.',
    '거래처 담당자 변경 건이 있으면 출고처관리/공급처관리 화면에서 담당자명을 바로 수정해주세요.'
  ];
  v_messenger_lines text[] := array[
    '오늘 입고 예정 건 확인 부탁드립니다.',
    '네, 확인했습니다. 창고 쪽에 전달해둘게요.',
    '이번 주 재고 실사 일정 공유드립니다 — 공지사항 확인 부탁드려요.',
    '거래처에서 견적 요청이 들어왔는데 구매 견적요청으로 등록해뒀습니다.',
    '수고하셨습니다!',
    '미수금 현황 한번씩 확인 부탁드립니다.'
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
  v_channel_id uuid;
  v_payment_amount numeric;
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

  for i in 1..array_length(v_dept_names, 1) loop
    insert into public.departments (name, sort_order) values (v_dept_names[i], i);
  end loop;

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

  -- 반품 3건 — create_sale_with_items를 p_is_return=true로 호출(기존
  -- RPC 그대로 재사용, migration 206 주석대로 원매출 참조 없는 자유
  -- 반품이다).
  for i in 1..3 loop
    v_pick := 1 + floor(random() * array_length(v_product_ids, 1))::int;
    v_qty := 5 + floor(random() * 20);
    v_items := jsonb_build_array(jsonb_build_object(
      'productId', v_product_ids[v_pick],
      'quantity', v_qty,
      'unitPrice', (select price from public.products where id = v_product_ids[v_pick])
    ));
    perform public.create_sale_with_items(
      p_customer_id := v_customer_ids[1 + floor(random() * array_length(v_customer_ids, 1))::int],
      p_warehouse_id := v_warehouse_id,
      p_order_date := current_date - floor(random() * 20)::int,
      p_memo := '샌드박스 더미 반품 ' || i,
      p_created_by := v_actor,
      p_items := v_items,
      p_is_return := true,
      p_return_reason := '샌드박스 테스트 반품(불량)'
    );
  end loop;

  -- 수금 6건 — customer_payments는 tenant_id/is_demo 컬럼이 없고
  -- 매출 전표와 직접 연결되지도 않는다(거래처 잔액을 매출합계-수금합계로
  -- 그때그때 계산하는 구조) — 그냥 거래처별로 적당한 금액을 꽂아 넣는다.
  for i in 1..6 loop
    v_payment_amount := (50 + floor(random() * 300)) * 10000;
    insert into public.customer_payments (customer_id, paid_at, amount, method, memo, created_by)
    values (
      v_customer_ids[1 + floor(random() * array_length(v_customer_ids, 1))::int],
      current_date - floor(random() * 30)::int,
      v_payment_amount, '계좌이체', '샌드박스 더미 수금 ' || i, v_actor
    );
  end loop;

  -- 게시판(공지사항) 4건
  for i in 1..array_length(v_announcement_titles, 1) loop
    insert into public.announcements (title, content, created_by)
    values (v_announcement_titles[i], v_announcement_bodies[i], v_actor);
  end loop;

  -- 사내메신저 "전체" 채널에 더미 대화 — 사원 계정은 이 SQL 함수가 못
  -- 만들어서(위 주석 참고) 전부 지금 실행한 관리자 본인 발신으로
  -- 들어간다. settings/sandbox/actions.ts가 이 함수 호출 뒤에 service_role
  -- 로 사원 계정을 만들고, 같은 "전체" 채널에 그 사원들 이름으로 메시지를
  -- 몇 개 더 추가해 대화처럼 보이게 한다.
  v_channel_id := public.get_or_create_all_channel();
  for i in 1..array_length(v_messenger_lines, 1) loop
    insert into public.messenger_messages (sender_id, content, channel_id)
    values (v_actor, v_messenger_lines[i], v_channel_id);
  end loop;
end;
$$;

revoke all on function public.sandbox_seed() from public;
grant execute on function public.sandbox_seed() to authenticated;
