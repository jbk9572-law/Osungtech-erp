-- 보안 점검(모의침투 관점) 결과 수정 — 권한을 우회하는(security definer) 함수 중 호출자 확인이 빠진 것들.
--
--  1) insert_payment_request_line_item / insert_payment_request_receipt: 함수 안에서 RLS를 우회해 지급결의서를 읽고 쓰는데,
--     "그 결의서가 내 회사 것인지" 확인이 없었다 → 다른 회사 결의서 id를 알면 그쪽에 내역/영수증 줄을 끼워 넣을 수 있었다.
--     내 회사 결의서가 아니면 거절하고, 영수증의 등록자는 호출자 본인(auth.uid())으로 고정한다(인자로 남을 사칭 불가).
--  2) get_database_size / get_storage_size: 일반 회사 사용자도 서비스 전체 DB·저장소 용량을 볼 수 있었다 → 플랫폼 운영자만.
--     (쓰는 곳은 플랫폼 관리자 통계 화면뿐이라 기능 영향 없음)
--  3) increment_platform_r2_class_a_ops: 로그인한 누구나 임의의 큰 수를 넣어 플랫폼 사용량 집계를 망가뜨릴 수 있었다 → 호출당 최대 1000으로 제한.

create or replace function public.insert_payment_request_line_item(
  p_payment_request_id uuid,
  p_used_at date,
  p_vendor text,
  p_purpose text,
  p_amount numeric,
  p_remark text,
  p_is_highlighted boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_next integer;
  v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext(p_payment_request_id::text));

  select status into v_status from public.payment_requests
  where id = p_payment_request_id and tenant_id = public.current_tenant_id();
  if not found then
    raise exception '지급결의서를 찾을 수 없습니다.';
  end if;
  if v_status is distinct from 'draft' then
    raise exception '이미 제출(마감)된 지급결의서에는 내역을 추가할 수 없습니다.';
  end if;

  select coalesce(max(sort_order), -1) + 1
    into v_next
    from public.payment_request_line_items
    where payment_request_id = p_payment_request_id;

  insert into public.payment_request_line_items
    (payment_request_id, used_at, vendor, purpose, amount, remark, sort_order, is_highlighted)
  values
    (p_payment_request_id, p_used_at, p_vendor, p_purpose, p_amount, p_remark, v_next, p_is_highlighted)
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.insert_payment_request_receipt(
  p_payment_request_id uuid,
  p_file_path text,
  p_file_url text,
  p_created_by uuid,
  p_size_bytes integer default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next integer;
  v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext(p_payment_request_id::text));

  if not exists (
    select 1 from public.payment_requests where id = p_payment_request_id and tenant_id = public.current_tenant_id()
  ) then
    raise exception '지급결의서를 찾을 수 없습니다.';
  end if;

  select coalesce(max(sort_order), -1) + 1
    into v_next
    from public.payment_request_receipts
    where payment_request_id = p_payment_request_id;

  insert into public.payment_request_receipts
    (payment_request_id, file_path, file_url, sort_order, created_by, size_bytes)
  values
    (p_payment_request_id, p_file_path, p_file_url, v_next, coalesce(auth.uid(), p_created_by), p_size_bytes)
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.get_database_size()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception '플랫폼 운영자만 조회할 수 있습니다.';
  end if;
  return pg_database_size(current_database());
end;
$$;

create or replace function public.get_storage_size()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception '플랫폼 운영자만 조회할 수 있습니다.';
  end if;
  return (select coalesce(sum((metadata->>'size')::bigint), 0) from storage.objects);
end;
$$;

create or replace function public.increment_platform_r2_class_a_ops(p_count integer default 1)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year_month text := to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM');
  v_new_count bigint;
  v_add integer := least(greatest(0, coalesce(p_count, 0)), 1000);
begin
  insert into public.platform_r2_ops_usage (year_month, class_a_count)
  values (v_year_month, v_add)
  on conflict (year_month) do update
    set class_a_count = public.platform_r2_ops_usage.class_a_count + v_add,
        updated_at = now()
  returning class_a_count into v_new_count;

  return v_new_count;
end;
$$;
