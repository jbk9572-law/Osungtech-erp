-- 상태를 "읽고 → 검사 → 쓰기" 하는 함수에 행 잠금이 없던 3곳(DB 함수 전체를 자동 점검해서 찾음). 같은 건을 더블클릭/두 사람이 동시에 처리하면
-- 둘 다 "임시 작성/open 상태"를 읽고 통과해서 결재 문서가 두 개 만들어지거나(지급결의서·구매요청 제출), 구매요청이 두 개 만들어졌다(견적요청 전환).
-- → 그 행을 for update 로 잠가 한 번에 한 명만 처리한다(결재 250·251, 생산지시 258 과 같은 방식). 함수 모양(인자·반환)은 그대로.

create or replace function public.submit_payment_request(
  p_id uuid,
  p_approver_ids uuid[],
  p_reference_ids uuid[] default '{}'
)
returns uuid
language plpgsql
as $$
declare
  v_actor uuid := auth.uid();
  v_owner uuid;
  v_status text;
  v_department text;
  v_card_type text;
  v_period_from date;
  v_item_count integer;
  v_total numeric;
  v_doc_id uuid;
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;
  if p_approver_ids is null or array_length(p_approver_ids, 1) is null then
    raise exception '결재선(승인자)을 1명 이상 지정해주세요.';
  end if;

  select requested_by, status, department, card_type, period_from
    into v_owner, v_status, v_department, v_card_type, v_period_from
  from public.payment_requests where id = p_id
  for update;

  if v_owner is null then
    raise exception '지급결의서를 찾을 수 없습니다.';
  end if;
  if v_owner is distinct from v_actor and not public.is_admin() then
    raise exception '본인이 작성한 지급결의서만 제출할 수 있습니다.';
  end if;
  if v_status is distinct from 'draft' then
    raise exception '임시 작성 상태의 지급결의서만 제출할 수 있습니다.';
  end if;

  select count(*), coalesce(sum(amount), 0) into v_item_count, v_total
  from public.payment_request_line_items where payment_request_id = p_id;
  if v_item_count = 0 then
    raise exception '사용 내역이 없는 지급결의서는 제출할 수 없습니다.';
  end if;

  v_doc_id := public.submit_approval_document(
    coalesce(v_department, '부서미지정') || ' · ' || coalesce(v_card_type, '') || ' · '
      || to_char(coalesce(v_period_from, current_date), 'YYYY-MM') || ' 지급결의서 (' || v_total || '원)',
    '사용 내역 ' || v_item_count || '건, 합계 ' || v_total || '원',
    p_approver_ids,
    p_reference_ids
  );

  update public.payment_requests
  set status = 'pending', approval_document_id = v_doc_id
  where id = p_id;

  update public.approval_documents set source_type = 'payment_request', source_id = p_id where id = v_doc_id;

  return v_doc_id;
end;
$$;

create or replace function public.submit_purchase_request(
  p_id uuid,
  p_approver_ids uuid[],
  p_reference_ids uuid[] default '{}'
)
returns uuid
language plpgsql
as $$
declare
  v_actor uuid := auth.uid();
  v_owner uuid;
  v_status text;
  v_supplier_name text;
  v_item_count integer;
  v_total numeric;
  v_doc_id uuid;
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;
  if p_approver_ids is null or array_length(p_approver_ids, 1) is null then
    raise exception '결재선(승인자)을 1명 이상 지정해주세요.';
  end if;

  select pr.requested_by, pr.status, s.name
    into v_owner, v_status, v_supplier_name
  from public.purchase_requests pr
  join public.suppliers s on s.id = pr.supplier_id
  where pr.id = p_id
  for update of pr;

  if v_owner is null then
    raise exception '구매요청을 찾을 수 없습니다.';
  end if;
  if v_owner is distinct from v_actor and not public.is_admin() then
    raise exception '본인이 작성한 구매요청만 제출할 수 있습니다.';
  end if;
  if v_status is distinct from 'draft' then
    raise exception '임시 작성 상태의 구매요청만 제출할 수 있습니다.';
  end if;

  select count(*), coalesce(sum(quantity * estimated_unit_price), 0) into v_item_count, v_total
  from public.purchase_request_items where purchase_request_id = p_id;
  if v_item_count = 0 then
    raise exception '품목이 없는 구매요청은 제출할 수 없습니다.';
  end if;

  v_doc_id := public.submit_approval_document(
    coalesce(v_supplier_name, '공급처미지정') || ' 구매요청 (예상 ' || v_total || '원)',
    '품목 ' || v_item_count || '건, 예상 합계 ' || v_total || '원',
    p_approver_ids,
    p_reference_ids
  );

  update public.purchase_requests
  set status = 'pending', approval_document_id = v_doc_id
  where id = p_id;

  update public.approval_documents set source_type = 'purchase_request', source_id = p_id where id = v_doc_id;

  return v_doc_id;
end;
$$;

create or replace function public.convert_purchase_quote_request(
  p_id uuid,
  p_supplier_id uuid
)
returns uuid
language plpgsql
as $$
declare
  v_actor uuid := auth.uid();
  v_status text;
  v_owner uuid;
  v_target_supplier_ids uuid[];
  v_request_id uuid;
  v_items jsonb;
begin
  if v_actor is null then
    raise exception '인증되지 않은 요청입니다.';
  end if;

  select status, created_by, target_supplier_ids into v_status, v_owner, v_target_supplier_ids
  from public.purchase_quote_requests where id = p_id
  for update;

  if v_status is null then
    raise exception '견적요청을 찾을 수 없습니다.';
  end if;
  if v_owner is distinct from v_actor and not public.is_admin() then
    raise exception '본인이 작성한 견적요청만 전환할 수 있습니다.';
  end if;
  if v_status <> 'open' then
    raise exception '이미 처리된 견적요청입니다.';
  end if;
  if not (p_supplier_id = any(v_target_supplier_ids)) then
    raise exception '견적을 요청하지 않은 공급처입니다.';
  end if;

  select jsonb_agg(jsonb_build_object(
    'productId', i.product_id,
    'customName', i.custom_name,
    'spec', i.spec,
    'quantity', i.quantity,
    'estimatedUnitPrice', coalesce(pr.unit_price, 0),
    'remark', i.remark
  ))
  into v_items
  from public.purchase_quote_request_items i
  left join public.purchase_quote_prices pr
    on pr.purchase_quote_request_item_id = i.id and pr.supplier_id = p_supplier_id
  where i.purchase_quote_request_id = p_id;

  v_request_id := public.create_purchase_request_with_items(p_supplier_id, current_date, '견적요청에서 전환', coalesce(v_items, '[]'::jsonb));

  update public.purchase_quote_requests
  set status = 'closed', selected_supplier_id = p_supplier_id, converted_purchase_request_id = v_request_id
  where id = p_id;

  return v_request_id;
end;
$$;

revoke all on function public.submit_payment_request(uuid, uuid[], uuid[]) from public;
grant execute on function public.submit_payment_request(uuid, uuid[], uuid[]) to authenticated;
revoke all on function public.submit_purchase_request(uuid, uuid[], uuid[]) from public;
grant execute on function public.submit_purchase_request(uuid, uuid[], uuid[]) to authenticated;
revoke all on function public.convert_purchase_quote_request(uuid, uuid) from public;
grant execute on function public.convert_purchase_quote_request(uuid, uuid) to authenticated;
