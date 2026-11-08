-- 사용자 지적 — 샌드박스로 구매요청서 화면을 열어보니 "조건에 맞는
-- 구매요청이 없습니다"만 뜸(모바일 레이아웃 확인 중 발견). migration
-- 217까지 매입/매출/반품/수금/공지/할일/메신저는 꽤 두텁게 채웠지만,
-- 구매요청서(purchase_requests)·구매견적요청(purchase_quote_requests)·
-- 견적서(quotes)·지급결의서(payment_requests)·매입처 지급내역
-- (supplier_payments)은 지금까지 sandbox_seed()가 전혀 안 채우고
-- 있었다 — 이 5개 화면은 항상 빈 상태로만 보였다.
--
-- create or replace function이라 217의 본문을 전부 그대로 옮기고
-- (213→216→217도 같은 방식으로 누적) 맨 끝에 이 5개 문서를 새로
-- 채우는 블록만 추가한다 — 기존 매입/매출/반품/수금/엣지케이스
-- 블록은 전혀 안 바뀜.
create or replace function public.sandbox_seed()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_warehouse_id uuid;
  v_warehouse2_id uuid;
  v_tmp_id uuid;
  v_supplier_ids uuid[] := '{}';
  v_customer_ids uuid[] := '{}';
  v_product_ids uuid[] := '{}';
  v_dept_names text[] := array['영업부', '구매부', '경영지원부', '생산부'];
  v_product_names text[] := array[
    '크라프트지95', '크라프트지120', '아트지150', '모조지80', '모조지100',
    '무진지', '띠지25mm', '띠지34mm', '커버테이프', '백(100)',
    '백(150)', '필터125mm', '필터150mm', 'OPP테이프', '완충재',
    '특수아트지200', '모조지120', '레이블지', 'OPP봉투', '뽁뽁이(에어캡)',
    '종이테이프', 'PE테이프', '박스(소)', '박스(대)'
  ];
  v_product_units text[] := array[
    'EA', 'EA', 'EA', 'EA', 'EA', 'EA', 'ROLL', 'ROLL', 'ROLL', 'EA', 'EA', 'EA', 'EA', 'ROLL', 'EA',
    'EA', 'EA', 'ROLL', 'EA', 'ROLL', 'ROLL', 'ROLL', 'EA', 'EA'
  ];
  v_announcement_titles text[] := array[
    '11월 정기 재고 실사 안내', '매입 전표 등록 시 로트번호 필수 입력 안내',
    '사내 메신저 "전체" 채널 이용 안내', '거래처 담당자 변경 공지',
    '부가세 신고 자료 마감 안내', '신규 입사자 환영 인사', '창고 정리 협조 요청',
    '구매 견적요청 처리 기한 안내'
  ];
  v_announcement_bodies text[] := array[
    '11월 넷째 주 중 창고별 재고 실사를 진행합니다. 담당 창고는 사전에 QR 자동실사로 수량을 미리 확인해주세요.',
    '매입 등록 시 로트번호를 비워두면 추후 재고 조회가 어렵습니다. 입고관리 > 품목 등록 시 꼭 기재 부탁드립니다.',
    '사내메신저 "전체" 채널은 공지/긴급 전달용입니다. 개별 업무 논의는 담당자와 직접 메시지로 부탁드립니다.',
    '거래처 담당자 변경 건이 있으면 출고처관리/공급처관리 화면에서 담당자명을 바로 수정해주세요.',
    '부가세 신고 자료 화면에서 이번 분기 매출/매입 자료를 이번 주까지 확인해주세요.',
    '이번 달 입사한 신규 사원분들 잘 부탁드립니다 — 사내메신저로 인사 나눠주세요.',
    '제2창고 정리 예정입니다. 보관 중인 품목이 있으면 미리 재고현황에서 위치를 확인해주세요.',
    '구매 견적요청은 접수 후 3영업일 이내 처리를 원칙으로 합니다.'
  ];
  v_messenger_lines text[] := array[
    '오늘 입고 예정 건 확인 부탁드립니다.',
    '네, 확인했습니다. 창고 쪽에 전달해둘게요.',
    '이번 주 재고 실사 일정 공유드립니다 — 공지사항 확인 부탁드려요.',
    '거래처에서 견적 요청이 들어왔는데 구매 견적요청으로 등록해뒀습니다.',
    '수고하셨습니다!',
    '미수금 현황 한번씩 확인 부탁드립니다.',
    '제2창고 재고도 같이 확인 부탁드려요.',
    '오늘 매출 건 중 샘플로 나간 것도 있어서 별도 표시해뒀습니다.',
    '반품 처리 완료했습니다, 재고 반영 확인 부탁드려요.'
  ];
  v_todo_titles text[] := array[
    '11월 재고실사 결과 정리', '거래처 미수금 확인 전화', '신규 거래처 등록 서류 검토',
    '분기 결산 자료 준비', '지난달 정산 완료'
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
  v_wh uuid;
  v_pqr_id uuid;
  v_card_types text[] := array['개인카드', '하나법인카드', '신한법인카드'];
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
  insert into public.warehouses (name, location) values ('샌드박스 제2창고', '테스트용 분산 창고')
  returning id into v_warehouse2_id;

  for i in 1..array_length(v_dept_names, 1) loop
    insert into public.departments (name, sort_order) values (v_dept_names[i], i);
  end loop;

  for i in 1..15 loop
    insert into public.suppliers (name, contact_name) values ('샌드박스 매입처' || i, '담당자' || i)
    returning id into v_tmp_id;
    v_supplier_ids := v_supplier_ids || v_tmp_id;
  end loop;

  for i in 1..20 loop
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

  -- 매입 300건 — 최근 45일에 걸쳐, 건마다 품목 1~3개, 창고는 두 곳에
  -- 섞어서(여러 창고 분산 확인용).
  for i in 1..300 loop
    v_order_date := current_date - floor(random() * 45)::int;
    v_item_count := 1 + floor(random() * 3)::int;
    v_items := '[]'::jsonb;
    for j in 1..v_item_count loop
      v_pick := 1 + floor(random() * (array_length(v_product_ids, 1) - 2))::int;
      if v_pick >= 3 then
        v_pick := v_pick + 2;
      end if;
      v_qty := 50 + floor(random() * 400);
      v_items := v_items || jsonb_build_array(jsonb_build_object(
        'productId', v_product_ids[v_pick],
        'quantity', v_qty,
        'unitCost', (select cost from public.products where id = v_product_ids[v_pick])
      ));
    end loop;
    v_wh := case when random() < 0.5 then v_warehouse_id else v_warehouse2_id end;
    perform public.create_purchase_with_items(
      v_supplier_ids[1 + floor(random() * array_length(v_supplier_ids, 1))::int],
      v_wh, v_order_date, '샌드박스 더미 매입 ' || i, v_actor, v_items,
      null, null, null, false, case when i % 15 = 0 then '면세' when i % 23 = 0 then '영세' else '과세' end
    );
  end loop;

  -- 매출 600건 — 최근 40일에 걸쳐, 건마다 품목 1~3개.
  for i in 1..600 loop
    v_order_date := current_date - floor(random() * 40)::int;
    v_item_count := 1 + floor(random() * 3)::int;
    v_items := '[]'::jsonb;
    for j in 1..v_item_count loop
      v_pick := 1 + floor(random() * (array_length(v_product_ids, 1) - 2))::int;
      if v_pick >= 3 then
        v_pick := v_pick + 2;
      end if;
      v_qty := 10 + floor(random() * 150);
      v_items := v_items || jsonb_build_array(jsonb_build_object(
        'productId', v_product_ids[v_pick],
        'quantity', v_qty,
        'unitPrice', (select price from public.products where id = v_product_ids[v_pick])
      ));
    end loop;
    v_wh := case when random() < 0.5 then v_warehouse_id else v_warehouse2_id end;
    perform public.create_sale_with_items(
      p_customer_id := v_customer_ids[1 + floor(random() * array_length(v_customer_ids, 1))::int],
      p_warehouse_id := v_wh,
      p_order_date := v_order_date,
      p_memo := '샌드박스 더미 매출 ' || i,
      p_created_by := v_actor,
      p_items := v_items,
      p_is_carryover := false,
      p_tax_type := case when i % 30 = 0 then '면세' when i % 41 = 0 then '영세' else '과세' end,
      p_is_sample := (i % 50 = 0)
    );
  end loop;

  -- 반품 60건
  for i in 1..60 loop
    v_pick := 1 + floor(random() * (array_length(v_product_ids, 1) - 2))::int;
    if v_pick >= 3 then
      v_pick := v_pick + 2;
    end if;
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
      p_return_reason := (array['불량', '수량 오류', '거래처 변심', '규격 상이'])[1 + floor(random() * 4)::int]
    );
  end loop;

  -- 이월(carryover) 매입 2건 + 매출 3건.
  for i in 1..2 loop
    v_pick := 1 + floor(random() * (array_length(v_product_ids, 1) - 2))::int;
    if v_pick >= 3 then
      v_pick := v_pick + 2;
    end if;
    v_items := jsonb_build_array(jsonb_build_object(
      'productId', v_product_ids[v_pick], 'quantity', 100,
      'unitCost', (select cost from public.products where id = v_product_ids[v_pick])
    ));
    perform public.create_purchase_with_items(
      v_supplier_ids[1], v_warehouse_id, current_date - 1,
      '샌드박스 더미 이월매입 ' || i, v_actor, v_items,
      null, null, null, true
    );
  end loop;
  for i in 1..3 loop
    v_pick := 1 + floor(random() * (array_length(v_product_ids, 1) - 2))::int;
    if v_pick >= 3 then
      v_pick := v_pick + 2;
    end if;
    v_items := jsonb_build_array(jsonb_build_object(
      'productId', v_product_ids[v_pick], 'quantity', 20,
      'unitPrice', (select price from public.products where id = v_product_ids[v_pick])
    ));
    perform public.create_sale_with_items(
      p_customer_id := v_customer_ids[1],
      p_warehouse_id := v_warehouse_id,
      p_order_date := current_date - 1,
      p_memo := '샌드박스 더미 이월매출 ' || i,
      p_created_by := v_actor,
      p_items := v_items,
      p_is_carryover := true
    );
  end loop;

  -- 오늘 날짜에 몰린 매입 4건 + 매출 6건.
  for i in 1..4 loop
    v_pick := 1 + floor(random() * (array_length(v_product_ids, 1) - 2))::int;
    if v_pick >= 3 then
      v_pick := v_pick + 2;
    end if;
    v_items := jsonb_build_array(jsonb_build_object(
      'productId', v_product_ids[v_pick], 'quantity', 50 + floor(random() * 200),
      'unitCost', (select cost from public.products where id = v_product_ids[v_pick])
    ));
    perform public.create_purchase_with_items(
      v_supplier_ids[1 + floor(random() * array_length(v_supplier_ids, 1))::int],
      v_warehouse_id, current_date, '샌드박스 더미 오늘매입 ' || i, v_actor, v_items
    );
  end loop;
  for i in 1..6 loop
    v_pick := 1 + floor(random() * (array_length(v_product_ids, 1) - 2))::int;
    if v_pick >= 3 then
      v_pick := v_pick + 2;
    end if;
    v_items := jsonb_build_array(jsonb_build_object(
      'productId', v_product_ids[v_pick], 'quantity', 10 + floor(random() * 80),
      'unitPrice', (select price from public.products where id = v_product_ids[v_pick])
    ));
    perform public.create_sale_with_items(
      v_customer_ids[1 + floor(random() * array_length(v_customer_ids, 1))::int],
      v_warehouse_id, current_date, '샌드박스 더미 오늘매출 ' || i, v_actor, v_items
    );
  end loop;

  -- 대형 단일 매출 1건.
  v_items := jsonb_build_array(jsonb_build_object(
    'productId', v_product_ids[1], 'quantity', 50000,
    'unitPrice', (select price from public.products where id = v_product_ids[1])
  ));
  perform public.create_sale_with_items(
    v_customer_ids[2], v_warehouse_id, current_date - 3, '샌드박스 더미 대형매출', v_actor, v_items
  );

  -- 재고위험(안전재고 이하) 품목 1개.
  v_items := jsonb_build_array(jsonb_build_object(
    'productId', v_product_ids[3], 'quantity', 5,
    'unitCost', (select cost from public.products where id = v_product_ids[3])
  ));
  perform public.create_purchase_with_items(
    v_supplier_ids[1], v_warehouse_id, current_date - 10, '샌드박스 더미 재고위험용 소량매입', v_actor, v_items
  );
  v_items := jsonb_build_array(jsonb_build_object(
    'productId', v_product_ids[3], 'quantity', 3,
    'unitPrice', (select price from public.products where id = v_product_ids[3])
  ));
  perform public.create_sale_with_items(
    v_customer_ids[3], v_warehouse_id, current_date - 2, '샌드박스 더미 재고위험용 매출', v_actor, v_items
  );

  -- 음수/0 재고 품목 1개.
  v_items := jsonb_build_array(jsonb_build_object(
    'productId', v_product_ids[4], 'quantity', 99999,
    'unitPrice', (select price from public.products where id = v_product_ids[4])
  ));
  perform public.create_sale_with_items(
    v_customer_ids[4], v_warehouse_id, current_date - 1, '샌드박스 더미 음수재고용 매출', v_actor, v_items
  );

  -- 선수금(수금 합계가 매출 합계를 넘는 거래처) 1곳.
  insert into public.customer_payments (customer_id, paid_at, amount, method, memo, created_by)
  values (v_customer_ids[1], current_date, 50000000, '계좌이체', '샌드박스 더미 선수금', v_actor);

  -- 수금 120건
  for i in 1..120 loop
    v_payment_amount := (50 + floor(random() * 300)) * 10000;
    insert into public.customer_payments (customer_id, paid_at, amount, method, memo, created_by)
    values (
      v_customer_ids[1 + floor(random() * array_length(v_customer_ids, 1))::int],
      current_date - floor(random() * 30)::int,
      v_payment_amount,
      (array['계좌이체', '현금', '카드'])[1 + floor(random() * 3)::int],
      '샌드박스 더미 수금 ' || i, v_actor
    );
  end loop;

  -- 게시판(공지사항) — 1건은 고정(pinned).
  for i in 1..array_length(v_announcement_titles, 1) loop
    insert into public.announcements (title, content, created_by, pinned)
    values (v_announcement_titles[i], v_announcement_bodies[i], v_actor, i = 1);
  end loop;

  -- 할일 5건 — 지연/오늘마감/예정/날짜없음/완료 각 1건.
  insert into public.todos (title, due_date, done, created_by) values
    (v_todo_titles[1], current_date - 2, false, v_actor),
    (v_todo_titles[2], current_date, false, v_actor),
    (v_todo_titles[3], current_date + 3, false, v_actor),
    (v_todo_titles[4], null, false, v_actor);
  insert into public.todos (title, due_date, done, done_at, created_by)
  values (v_todo_titles[5], current_date - 15, true, now(), v_actor);

  -- 사내메신저 "전체" 채널에 더미 대화.
  v_channel_id := public.get_or_create_all_channel();
  for i in 1..60 loop
    insert into public.messenger_messages (sender_id, content, channel_id)
    values (v_actor, v_messenger_lines[1 + ((i - 1) % array_length(v_messenger_lines, 1))], v_channel_id);
  end loop;

  -- ── 여기부터 migration 220 신규 추가분 ──────────────────────────
  -- 지금까지 한 번도 안 채워졌던 5개 문서함(구매요청서/구매견적요청/
  -- 견적서/지급결의서/매입처 지급내역)을 채운다. 전부 실제 화면이 쓰는
  -- 것과 같은 RPC/테이블을 그대로 재사용(새 로직 없음). 결재 승인/반려
  -- 상태 전환은 결재선(approval line) 구조가 필요해 여기서는 다루지
  -- 않고 모두 기본 상태(초안/open)로 둔다 — 그래도 목록·상세 화면이
  -- 빈 상태 대신 실제 데이터로 채워지는 게 핵심이다.

  -- 구매요청서 8건 — 공급처/수량/예상단가 섞어서, 품목 1~2개씩.
  for i in 1..8 loop
    v_item_count := 1 + floor(random() * 2)::int;
    v_items := '[]'::jsonb;
    for j in 1..v_item_count loop
      v_pick := 1 + floor(random() * array_length(v_product_ids, 1))::int;
      v_items := v_items || jsonb_build_array(jsonb_build_object(
        'productId', v_product_ids[v_pick],
        'spec', null,
        'quantity', 20 + floor(random() * 200),
        'estimatedUnitPrice', (select cost from public.products where id = v_product_ids[v_pick]),
        'remark', null
      ));
    end loop;
    perform public.create_purchase_request_with_items(
      v_supplier_ids[1 + floor(random() * array_length(v_supplier_ids, 1))::int],
      current_date - floor(random() * 20)::int,
      '샌드박스 더미 구매요청 ' || i,
      v_items
    );
  end loop;

  -- 구매견적요청 5건 — 매번 공급처 2~3곳에 동시 요청(여러 업체 비교
  -- 화면 확인용).
  for i in 1..5 loop
    v_item_count := 1 + floor(random() * 2)::int;
    v_items := '[]'::jsonb;
    for j in 1..v_item_count loop
      v_pick := 1 + floor(random() * array_length(v_product_ids, 1))::int;
      v_items := v_items || jsonb_build_array(jsonb_build_object(
        'productId', v_product_ids[v_pick],
        'spec', null,
        'quantity', 50 + floor(random() * 300),
        'remark', null
      ));
    end loop;
    select public.create_purchase_quote_request_with_items(
      array[v_supplier_ids[i], v_supplier_ids[i + 1], v_supplier_ids[i + 2]],
      current_date - floor(random() * 15)::int,
      '샌드박스 더미 구매견적요청 ' || i,
      v_items
    ) into v_pqr_id;
    -- 그중 1건은 공급처 하나가 이미 견적가를 준 상태로(비교 화면 확인용).
    -- set_purchase_quote_prices는 품목id(itemId) 기준이라, 방금 만든
    -- 요청의 실제 품목 행 id를 먼저 조회해서 넘긴다.
    if i = 1 then
      perform public.set_purchase_quote_prices(
        v_pqr_id, v_supplier_ids[1],
        (
          select jsonb_agg(jsonb_build_object('itemId', pqri.id, 'unitPrice', 5000))
          from public.purchase_quote_request_items pqri
          where pqri.purchase_quote_request_id = v_pqr_id
        )
      );
    end if;
  end loop;

  -- 견적서 10건 — 유효기간 있는 것/없는 것/이미 지난 것(만료 엣지
  -- 케이스) 섞어서.
  for i in 1..10 loop
    v_item_count := 1 + floor(random() * 3)::int;
    v_items := '[]'::jsonb;
    for j in 1..v_item_count loop
      v_pick := 1 + floor(random() * array_length(v_product_ids, 1))::int;
      v_items := v_items || jsonb_build_array(jsonb_build_object(
        'productId', v_product_ids[v_pick],
        'spec', null,
        'quantity', 10 + floor(random() * 100),
        'unitPrice', (select price from public.products where id = v_product_ids[v_pick]),
        'remark', null
      ));
    end loop;
    perform public.create_quote_with_items(
      v_customer_ids[1 + floor(random() * array_length(v_customer_ids, 1))::int],
      current_date - floor(random() * 25)::int,
      case
        when i = 1 then current_date - 5 -- 이미 만료된 견적서 1건
        when i % 3 = 0 then null::date -- 유효기간 없는 견적서
        else current_date + 14
      end,
      '샌드박스 더미 견적서 ' || i,
      v_items
    );
  end loop;

  -- 지급결의서 4건 — 부서/카드종류 섞어서, 사용내역 2~3줄씩.
  for i in 1..4 loop
    v_items := '[]'::jsonb;
    for j in 1..(2 + floor(random() * 2)::int) loop
      v_items := v_items || jsonb_build_array(jsonb_build_object(
        'usedAt', (current_date - floor(random() * 25)::int)::text,
        'vendor', (array['사내 문구점', '택배사', '거래처 접대', '주유소', '출장 숙박'])[1 + floor(random() * 5)::int],
        'purpose', '샌드박스 더미 사용내역',
        'amount', (1 + floor(random() * 30)) * 10000,
        'remark', null,
        'sortOrder', j,
        'isHighlighted', (j = 1 and i = 1)
      ));
    end loop;
    perform public.create_payment_request_with_items(
      v_dept_names[1 + floor(random() * array_length(v_dept_names, 1))::int],
      current_date - 30, current_date,
      v_card_types[1 + floor(random() * array_length(v_card_types, 1))::int],
      v_actor,
      v_items
    );
  end loop;

  -- 매입처 지급내역 40건 — customer_payments(수금)와 대칭.
  for i in 1..40 loop
    insert into public.supplier_payments (supplier_id, paid_at, amount, method, memo, created_by)
    values (
      v_supplier_ids[1 + floor(random() * array_length(v_supplier_ids, 1))::int],
      current_date - floor(random() * 30)::int,
      (50 + floor(random() * 300)) * 10000,
      (array['계좌이체', '현금', '카드'])[1 + floor(random() * 3)::int],
      '샌드박스 더미 지급 ' || i, v_actor
    );
  end loop;
end;
$$;

revoke all on function public.sandbox_seed() from public;
grant execute on function public.sandbox_seed() to authenticated;
