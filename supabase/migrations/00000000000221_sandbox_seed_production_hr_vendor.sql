-- 사용자 요청 — 샌드박스 더미데이터에 지금까지 빠져 있던 영역을 채운다:
-- 부서 10곳 이상(기존 4곳), 생산지시내역(BOM/공정/생산지시 — 지금까지
-- 전혀 안 채워지고 있었다), 하청업체관리/외주비정산(업체+공정배정+
-- 지급), 이형·삼각거래(파생 SKU) 데모, 문서양식관리 20종 이상(지금까지
-- 0건이라 인사문서/공문 화면이 템플릿이 없어 항상 비어 보였다), 거래처
-- 포털 카탈로그용 판매단가. 사원끼리 메신저 대화/결재선/공문 결재·기안/
-- 거래처 발주승인은 실제 사람(auth 세션)이 여럿 필요해 이 SQL 함수
-- (단일 actor) 혼자서는 할 수 없다 — settings/sandbox/actions.ts의
-- TS 레이어(더미 사원 로그인 세션을 여러 개 만드는 곳)에서 같이 채운다.
--
-- create or replace function이라 220의 본문을 전부 그대로 옮기고(217→
-- 220도 같은 방식으로 누적) 새 블록만 추가한다 — 기존 블록은 전혀 안
-- 바뀜. 새 블록은 혹시 모를 실수(인덱스 범위, FK 등)가 전체 함수를
-- 롤백시켜 220까지의 검증된 더미데이터까지 같이 날아가지 않도록, 서로
-- 독립된 begin/exception 하위 블록으로 감싼다 — 한 블록이 실패해도
-- 나머지 블록과 기존 220 내용은 그대로 커밋된다.
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
  v_dept_names text[] := array[
    '영업부', '구매부', '경영지원부', '생산부',
    '인사부', '재무회계부', 'IT전산부', '품질관리부', '고객지원부', '해외영업부'
  ];
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
  -- migration 221 신규분 선언.
  v_dt_names text[];
  v_dt_categories text[];
  v_dt_bodies text[];
  v_process1_id uuid;
  v_process2_id uuid;
  v_subcontractor_ids uuid[] := '{}';
  v_derived_a_id uuid;
  v_derived_b_id uuid;
  v_step_rec record;
  v_step_count int;
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

  -- ── migration 220 추가분(변경 없음) ──────────────────────────────
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

  -- ── migration 221 신규 추가분 ────────────────────────────────────
  -- 각 영역을 독립된 하위 블록으로 감싼다 — 한 블록이 실패해도(인덱스
  -- 범위, 미처 못 본 제약조건 등) 나머지 블록과 위의 220까지 내용은
  -- 그대로 커밋된다(이 함수 전체가 하나의 트랜잭션이라, 감싸지 않으면
  -- 새로 추가한 블록 하나의 실수가 전체를 롤백시킬 위험이 있다).

  -- 1) 이형·삼각거래(파생 SKU) 데모 — 모품목 1개(모조지80)에, 거래처마다
  -- 다른 표기/단가로 내보내는 파생 SKU 2개를 연결한다. 재고는 모품목
  -- 쪽에만 쌓이고 파생 SKU는 parent_product_id로 그 재고를 공유해서
  -- 판매한다(품목관리 "모품목 선택" 필드 — 매입은 한 품목, 매출은
  -- 거래처별 다른 SKU/단가로 나가는 업종용 기능).
  begin
    insert into public.products (sku, name, unit, price, cost, parent_product_id)
    values (
      'SB-101-A', '모조지80(거래처A 전용표기)', 'EA',
      (select price * 1.05 from public.products where id = v_product_ids[5]),
      (select cost from public.products where id = v_product_ids[5]),
      v_product_ids[5]
    ) returning id into v_derived_a_id;
    insert into public.products (sku, name, unit, price, cost, parent_product_id)
    values (
      'SB-101-B', '모조지80(거래처B 전용표기)', 'EA',
      (select price * 0.95 from public.products where id = v_product_ids[5]),
      (select cost from public.products where id = v_product_ids[5]),
      v_product_ids[5]
    ) returning id into v_derived_b_id;

    v_items := jsonb_build_array(jsonb_build_object(
      'productId', v_product_ids[5], 'quantity', 500,
      'unitCost', (select cost from public.products where id = v_product_ids[5])
    ));
    perform public.create_purchase_with_items(
      v_supplier_ids[2], v_warehouse_id, current_date - 5,
      '샌드박스 더미 모품목 입고(이형거래)', v_actor, v_items
    );

    v_items := jsonb_build_array(jsonb_build_object(
      'productId', v_derived_a_id, 'quantity', 80,
      'unitPrice', (select price from public.products where id = v_derived_a_id)
    ));
    perform public.create_sale_with_items(
      v_customer_ids[5], v_warehouse_id, current_date - 3,
      '샌드박스 더미 파생SKU매출A(이형거래)', v_actor, v_items
    );
    v_items := jsonb_build_array(jsonb_build_object(
      'productId', v_derived_b_id, 'quantity', 60,
      'unitPrice', (select price from public.products where id = v_derived_b_id)
    ));
    perform public.create_sale_with_items(
      v_customer_ids[6], v_warehouse_id, current_date - 2,
      '샌드박스 더미 파생SKU매출B(이형거래)', v_actor, v_items
    );
  exception when others then
    null; -- 이형거래 데모 실패해도 나머지 더미데이터는 계속 진행한다.
  end;

  -- 2) 생산지시내역(work_orders) — BOM 1개(모품목+부자재)와 공정
  -- 2단계(재단/포장)를 기준정보로 먼저 깔고, create_work_order()로 실제
  -- 화면이 쓰는 경로 그대로 12건을 낸다.
  begin
    insert into public.bom_items (parent_product_id, component_product_id, quantity_per_unit)
    values (v_product_ids[1], v_product_ids[6], 1);

    insert into public.production_processes (name, sort_order) values ('재단', 1) returning id into v_process1_id;
    insert into public.production_processes (name, sort_order) values ('포장', 2) returning id into v_process2_id;
    insert into public.product_process_routes (product_id, process_id, sort_order) values
      (v_product_ids[1], v_process1_id, 1),
      (v_product_ids[1], v_process2_id, 2);

    for i in 1..12 loop
      perform public.create_work_order(
        v_product_ids[1], v_warehouse_id,
        (20 + floor(random() * 80))::numeric,
        (current_date - floor(random() * 15)::int),
        '샌드박스 더미 생산지시 ' || i
      );
    end loop;
  exception when others then
    null; -- BOM/생산지시 데모 실패해도 나머지 더미데이터는 계속 진행한다.
  end;

  -- 3) 하청업체관리 + 외주비정산 — 방금 낸 생산지시의 "포장" 공정 중
  -- 절반을 외주로 배정하고 단가를 매겨 가공비 누계가 쌓이게 한 뒤,
  -- 그 절반에 못 미치는 금액만 지급해 미정산 잔액이 화면에 남게 한다
  -- (get_subcontractor_balances는 담당(assignee_kind='subcontractor')
  -- 배정 자체로 가공비를 집계하므로 공정 상태를 꼭 'done'으로 바꿀
  -- 필요는 없다).
  begin
    for i in 1..6 loop
      insert into public.subcontractors (name, contact_name, default_unit_cost)
      values ('샌드박스 외주업체' || i, '담당자' || i, (500 + floor(random() * 2000))::numeric)
      returning id into v_tmp_id;
      v_subcontractor_ids := v_subcontractor_ids || v_tmp_id;
    end loop;

    v_step_count := 0;
    for v_step_rec in (
      select wops.id
      from public.work_order_process_steps wops
      join public.work_orders wo on wo.id = wops.work_order_id
      where wo.product_id = v_product_ids[1]
        and wops.process_name = '포장'
        and wops.status = 'pending'
      order by wops.id
    ) loop
      v_step_count := v_step_count + 1;
      if v_step_count % 2 = 1 then
        perform public.assign_work_order_process_step(
          p_id := v_step_rec.id,
          p_subcontractor_id := v_subcontractor_ids[1 + (v_step_count % array_length(v_subcontractor_ids, 1))]
        );
        perform public.set_work_order_process_step_unit_cost(
          p_id := v_step_rec.id,
          p_unit_cost := (800 + floor(random() * 1500))::numeric
        );
      end if;
    end loop;

    for i in 1..20 loop
      insert into public.subcontractor_payments (subcontractor_id, paid_at, amount, method, memo, created_by)
      values (
        v_subcontractor_ids[1 + floor(random() * array_length(v_subcontractor_ids, 1))::int],
        current_date - floor(random() * 20)::int,
        (10 + floor(random() * 50)) * 10000,
        (array['계좌이체', '현금'])[1 + floor(random() * 2)::int],
        '샌드박스 더미 외주비 지급 ' || i, v_actor
      );
    end loop;
  exception when others then
    null; -- 하청업체/외주비정산 데모 실패해도 나머지 더미데이터는 계속 진행한다.
  end;

  -- 4) 문서양식관리 21종 — 인사(계약서/증명서)·전자결재·공문·기타 5개
  -- 분류를 전부 채운다. 지금까지 샌드박스에 템플릿이 0건이라 인사문서/
  -- 전자결재/공문 화면이 전부 "양식 없음"으로 비어 보였다.
  begin
    v_dt_categories := array[
      'hr_contract', 'hr_contract', 'hr_contract', 'hr_contract',
      'hr_certificate', 'hr_certificate', 'hr_certificate', 'hr_certificate',
      'approval', 'approval', 'approval', 'approval', 'approval',
      'official', 'official', 'official', 'official',
      'general', 'general', 'general', 'general'
    ];
    v_dt_names := array[
      '표준 근로계약서', '연봉계약서', '인턴십 계약서', '비밀유지서약서(NDA)',
      '재직증명서', '경력증명서', '퇴직증명서', '소득확인서',
      '사무용품 구매 기안서', '출장비 정산 요청', '야근 식대 지급 요청', '교육비 지원 요청', '비품 폐기 승인 요청',
      '거래처 공지 공문', '가격 변경 안내 공문', '휴무 안내 공문', '세금계산서 발행 안내 공문',
      '업무 보고서', '회의록', '출장 보고서', '품질 점검 보고서'
    ];
    v_dt_bodies := array[
      '<p>{{company_name}}(이하 "갑")과 {{employee_name}}(이하 "을")은 다음과 같이 근로계약을 체결한다.</p><p>부서: {{department_name}} / 직위: {{position_title}} / 입사일: {{hire_date}}</p><p>작성일: {{today}}</p>',
      '<p>{{employee_name}}님의 연봉계약을 다음과 같이 체결합니다.</p><p>부서: {{department_name}} / 직위: {{position_title}}</p><p>작성일: {{today}} / 작성자: {{author_name}}</p>',
      '<p>{{employee_name}}님과 인턴십 계약을 체결합니다.</p><p>소속: {{department_name}}</p><p>작성일: {{today}}</p>',
      '<p>{{employee_name}}님은 재직 중 취득한 {{company_name}}의 영업비밀을 외부에 누설하지 않을 것을 서약합니다.</p><p>작성일: {{today}}</p>',
      '<p>{{company_name}}은 아래와 같이 재직 중임을 증명합니다.</p><p>성명: {{employee_name}} / 부서: {{department_name}} / 직위: {{position_title}} / 입사일: {{hire_date}}</p><p>발급일: {{today}} / 대표자: {{representative_name}}</p>',
      '<p>{{company_name}}은 아래 인원의 경력을 다음과 같이 증명합니다.</p><p>성명: {{employee_name}} / 부서: {{department_name}} / 직위: {{position_title}}</p><p>발급일: {{today}}</p>',
      '<p>{{company_name}}은 아래 인원이 퇴직하였음을 증명합니다.</p><p>성명: {{employee_name}} / 최종 부서: {{department_name}} / 최종 직위: {{position_title}}</p><p>발급일: {{today}}</p>',
      '<p>{{company_name}}은 아래 인원의 소득을 다음과 같이 확인합니다.</p><p>성명: {{employee_name}} / 부서: {{department_name}}</p><p>발급일: {{today}}</p>',
      '<p>아래와 같이 사무용품 구매를 기안합니다.</p><p>기안자: {{author_name}} / 기안일: {{today}}</p>',
      '<p>아래와 같이 출장비 정산을 요청합니다.</p><p>기안자: {{author_name}} / 기안일: {{today}}</p>',
      '<p>야근 식대 지급을 요청합니다.</p><p>기안자: {{author_name}} / 기안일: {{today}}</p>',
      '<p>교육비 지원을 요청합니다.</p><p>기안자: {{author_name}} / 기안일: {{today}}</p>',
      '<p>비품 폐기 승인을 요청합니다.</p><p>기안자: {{author_name}} / 기안일: {{today}}</p>',
      '<p>{{company_name}}에서 거래처 여러분께 아래와 같이 안내드립니다.</p><p>발신일: {{today}} / 작성자: {{author_name}}</p>',
      '<p>{{company_name}}의 품목 가격 변경을 아래와 같이 안내드립니다.</p><p>시행일: {{today}}</p>',
      '<p>{{company_name}}의 휴무 일정을 아래와 같이 안내드립니다.</p><p>작성일: {{today}}</p>',
      '<p>{{company_name}}의 세금계산서 발행 관련 사항을 아래와 같이 안내드립니다.</p><p>작성일: {{today}}</p>',
      '<p>{{author_name}}이(가) 작성한 업무 보고서입니다.</p><p>작성일: {{today}}</p>',
      '<p>회의록 — 작성자: {{author_name}} / 작성일: {{today}}</p>',
      '<p>출장 보고서 — 작성자: {{author_name}} / 작성일: {{today}}</p>',
      '<p>품질 점검 보고서 — 작성자: {{author_name}} / 작성일: {{today}}</p>'
    ];
    for i in 1..array_length(v_dt_names, 1) loop
      insert into public.document_templates (category, name, body, created_by)
      values (v_dt_categories[i], v_dt_names[i], v_dt_bodies[i], v_actor);
    end loop;
  exception when others then
    null; -- 문서양식 데모 실패해도 나머지 더미데이터는 계속 진행한다.
  end;

  -- 5) 거래처 포털 카탈로그(발주 가능 품목)용 판매단가 — 거래처 5곳 ×
  -- 품목 5개. 포털 계정/발주 자체는 실제 로그인 세션이 필요해 TS
  -- 레이어(settings/sandbox/actions.ts)에서 이 단가를 바탕으로 채운다.
  begin
    for i in 1..5 loop
      for j in 1..5 loop
        insert into public.customer_product_prices (customer_id, product_id, unit_price)
        values (v_customer_ids[i], v_product_ids[j], (select price from public.products where id = v_product_ids[j]));
      end loop;
    end loop;
  exception when others then
    null; -- 포털 단가 데모 실패해도 나머지 더미데이터는 계속 진행한다.
  end;
end;
$$;

revoke all on function public.sandbox_seed() from public;
grant execute on function public.sandbox_seed() to authenticated;
