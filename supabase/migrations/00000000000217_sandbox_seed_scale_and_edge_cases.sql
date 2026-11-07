-- "더미데이터를 니가말한거에 20배는 추가로 더해야 실사용같지않겟냐?
-- 엣지케이스들까지 예상해서 만들어야지" — 거래 "건수"(매입/매출/반품/
-- 수금/메신저)는 20배로 올린다. 거래처/매입처/품목처럼 "마스터 데이터"는
-- 20배로 올리면(예: 거래처 160곳) 오히려 소규모 제지·포장재 유통업체
-- 치고 비현실적이라 2~3배 선에서만 늘린다 — 실사용처럼 보이게 하려는
-- 목적엔 거래 "건수"가 많아야 한다는 게 핵심이라고 판단했다.
--
-- 엣지케이스(실무에서 화면이 깨지거나 헷갈리기 쉬운 경우들을 미리 채워
-- 둬서, 손으로 하나씩 만들어보지 않아도 바로 확인할 수 있게 한다):
--   - 음수/0 재고 품목(migration 38에서 허용됨) 1개
--   - 안전재고 이하 품목 1개(재고위험 패널)
--   - 이월(is_carryover) 매입/매출
--   - 샘플 매출(is_sample)
--   - 면세/영세 매입·매출(부가세 신고 자료 화면)
--   - 초과 수량/금액의 대형 단일 매출 1건(숫자 포맷 확인용)
--   - 오늘 날짜에 몰린 매입/매출 묶음(대시보드 "오늘의 업무" 패널이
--     랜덤 날짜만으로는 비어 보일 수 있어서 강제로 채움)
--   - 두 번째 창고(여러 창고 분산 확인용)
--   - 핀 고정 공지사항 1건
--   - 선수금(수금 합계가 매출 합계를 넘는 거래처) 1곳
--   - 할일(지연/오늘마감/예정/날짜없음/완료 각 1건씩) — 지금까지
--     sandbox_seed()가 todos를 전혀 안 채우고 있었다(대시보드 알림
--     띠의 지연 할일 표시도 빈 상태로만 보임).
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
      -- 품목 3/4번은 아래 "재고위험"/"음수재고" 전용 블록이 결과를
      -- 보장해야 해서 일반 랜덤 루프의 선택 대상에서 뺀다(빼지 않으면
      -- 큰 루프가 그 품목도 같이 사고팔아서 전용 블록이 만들어 둔
      -- 상태가 희석/소멸될 수 있다).
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
      -- 품목 3/4번은 아래 "재고위험"/"음수재고" 전용 블록이 결과를
      -- 보장해야 해서 일반 랜덤 루프의 선택 대상에서 뺀다(빼지 않으면
      -- 큰 루프가 그 품목도 같이 사고팔아서 전용 블록이 만들어 둔
      -- 상태가 희석/소멸될 수 있다).
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
    -- 품목 3/4번은 아래 "재고위험"/"음수재고" 전용 블록이 결과를 보장해야
    -- 해서 일반 랜덤 선택 대상에서 뺀다(위 300/600건 루프와 같은 이유).
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

  -- 이월(carryover) 매입 2건 + 매출 3건 — 전표날짜와 실제 작업일이 달라
  -- 보이는 케이스(대시보드 "이월 유입" 표시 확인용).
  for i in 1..2 loop
    -- 품목 3/4번은 아래 "재고위험"/"음수재고" 전용 블록이 결과를 보장해야
    -- 해서 일반 랜덤 선택 대상에서 뺀다(위 300/600건 루프와 같은 이유).
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
    -- 품목 3/4번은 아래 "재고위험"/"음수재고" 전용 블록이 결과를 보장해야
    -- 해서 일반 랜덤 선택 대상에서 뺀다(위 300/600건 루프와 같은 이유).
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

  -- 오늘 날짜에 몰린 매입 4건 + 매출 6건 — 랜덤 날짜만으로는 "오늘"이
  -- 비어 보일 수 있어서(대시보드 "오늘의 업무" 패널), 강제로 채운다.
  for i in 1..4 loop
    -- 품목 3/4번은 아래 "재고위험"/"음수재고" 전용 블록이 결과를 보장해야
    -- 해서 일반 랜덤 선택 대상에서 뺀다(위 300/600건 루프와 같은 이유).
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
    -- 품목 3/4번은 아래 "재고위험"/"음수재고" 전용 블록이 결과를 보장해야
    -- 해서 일반 랜덤 선택 대상에서 뺀다(위 300/600건 루프와 같은 이유).
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

  -- 대형 단일 매출 1건 — 숫자 포맷(큰 금액/수량) 확인용.
  v_items := jsonb_build_array(jsonb_build_object(
    'productId', v_product_ids[1], 'quantity', 50000,
    'unitPrice', (select price from public.products where id = v_product_ids[1])
  ));
  perform public.create_sale_with_items(
    v_customer_ids[2], v_warehouse_id, current_date - 3, '샌드박스 더미 대형매출', v_actor, v_items
  );

  -- 재고위험(안전재고 이하) 품목 1개 — 일부러 거의 안 사고 많이 팔아서
  -- 재고를 reorder_point 밑으로 떨어뜨린다.
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

  -- 음수/0 재고 품목 1개(migration 38에서 허용) — 구매 없이(또는 아주
  -- 조금만) 대량 매출을 내서 재고를 마이너스로 만든다.
  v_items := jsonb_build_array(jsonb_build_object(
    'productId', v_product_ids[4], 'quantity', 99999,
    'unitPrice', (select price from public.products where id = v_product_ids[4])
  ));
  perform public.create_sale_with_items(
    v_customer_ids[4], v_warehouse_id, current_date - 1, '샌드박스 더미 음수재고용 매출', v_actor, v_items
  );

  -- 선수금(수금 합계가 매출 합계를 넘는 거래처) 1곳 — 거래처1은 위에서
  -- 아직 적은 매출만 받았으니, 수금을 크게 넣는다.
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

  -- 사내메신저 "전체" 채널에 더미 대화 — 사원 계정은 이 SQL 함수가 못
  -- 만들어서(settings/sandbox/actions.ts가 이 함수 호출 뒤 service_role로
  -- 만들고, 같은 채널에 그 사원들 이름으로 메시지를 더 추가한다) 전부
  -- 지금 실행한 관리자 본인 발신으로 들어간다.
  v_channel_id := public.get_or_create_all_channel();
  for i in 1..60 loop
    insert into public.messenger_messages (sender_id, content, channel_id)
    values (v_actor, v_messenger_lines[1 + ((i - 1) % array_length(v_messenger_lines, 1))], v_channel_id);
  end loop;
end;
$$;

revoke all on function public.sandbox_seed() from public;
grant execute on function public.sandbox_seed() to authenticated;
