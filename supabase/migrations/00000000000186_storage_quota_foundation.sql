-- SaaS 요금제(Standard, 부가세포함 월 33,000원) 용량 쿼터 기반 작업.
--
-- 지금까지 tenants.points_balance(migration 123)는 "세금계산서/팩스
-- 발행 API가 실제로 붙을 때 깎을 포인트"를 미리 준비해둔 것이었는데,
-- 그 발행 자체가 지금은 전부 수기 표시라 실제 과금 로직이 없다. 이번
-- 작업은 그와 별개로 "DB 용량 50MB / 파일 저장소 300MB" 쿼터 — 지금
-- 당장 실제로 쌓이고 있는 실체가 있는 두 가지를 다룬다.
--
-- 쿼터 숫자 자체는 업체(테넌트)마다 수동으로 조정할 수 있어야 해서
-- platform_plans(카탈로그)가 아니라 tenants(실제 계약)에 직접 둔다 —
-- plan_key처럼 "카탈로그 vs 실제 계약 상태"를 분리했던 089/153과 같은
-- 이유다. 나중에 TODO_BILLING_AUTOMATION으로 애드온 패키지(+50MB,
-- +1GB)를 자동 결제로 파는 단계가 오면, 그때는 이 컬럼을 직접 올리는
-- 대신 "구매한 애드온 내역" 테이블을 얹고 그 합산으로 바꾸는 편이
-- 맞다 — 지금은 수동 관리 단계라 과도한 설계를 피하고 컬럼 하나로
-- 둔다.
alter table public.tenants add column if not exists db_quota_bytes bigint not null default 52428800; -- 50MB
alter table public.tenants add column if not exists file_quota_bytes bigint not null default 314572800; -- 300MB

-- 전자세금계산서/팩스 "100건+100건 기본 포함"은 스펙에 있지만, 실제로
-- 발행 API가 붙어있지 않아(위 주석) 지금 당장 소모시킬 지점이 없다.
-- 숫자 자체는 요금제 안내/빌링 화면에 표시할 수 있게 컬럼만 만들어
-- 두고, 실제 차감 트리거는 세금계산서/팩스 발행이 실제 API 호출로
-- 바뀌는 시점(TODO_BILLING_AUTOMATION과 묶어 진행)에 추가한다.
alter table public.tenants add column if not exists monthly_tax_invoice_quota integer not null default 100;
alter table public.tenants add column if not exists monthly_fax_quota integer not null default 100;

-- 테넌트별 실사용량. tenants 테이블 자체에 두지 않는 이유: usage는
-- 트리거가 매 트랜잭션마다 갱신하는 값이라 tenants의 다른 관리용
-- 컬럼(이름/슬러그/플랜 등)과 갱신 빈도·갱신 주체가 완전히 다르다 —
-- 같은 테이블에 섞으면 테넌트 정보를 수정하는 일반 UPDATE가 매번
-- usage 행과 락을 다투게 된다.
create table if not exists public.tenant_usage (
  tenant_id uuid primary key references public.tenants (id) on delete cascade,
  db_bytes_used bigint not null default 0,
  file_bytes_used bigint not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.tenant_usage enable row level security;

-- 자기 테넌트 사용량만 조회 가능. 갱신은 아래 SECURITY DEFINER
-- 함수/트리거를 통해서만 이뤄지므로 별도 insert/update 정책은 두지
-- 않는다(service_role 플랫폼 관리자 화면은 RLS를 우회하므로 그대로
-- 전체 조회 가능).
create policy "tenant_usage_select_own" on public.tenant_usage
  for select using (tenant_id = public.current_tenant_id());

-- DB 용량 추정치를 매 INSERT/UPDATE/DELETE마다 갱신하는 공용 트리거
-- 함수. 정확한 바이트 단위 과금이 목적이 아니라 "50MB에 가까워지고
-- 있는지"를 감지하는 소프트 쿼터이므로, 테이블 전체를 스캔해 정확한
-- 디스크 사용량을 재는 대신 pg_column_size(row)를 증분 합산한다 —
-- 매 쓰기 작업마다 추가되는 비용이 O(1)이라 전표가 많은 업종에서도
-- 부담이 없다.
create or replace function public.bump_tenant_db_usage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_delta bigint;
  v_is_demo boolean;
begin
  -- 데모 계정이 연습으로 넣는 가짜 데이터는 "실제 회사가 구매한 용량"을
  -- 깎아먹으면 안 된다 — is_demo_actor()/tenant_id 격리(migration 85/98)와
  -- 같은 전제로, 이 다섯 테이블 전부 is_demo 컬럼을 이미 갖고 있다.
  if tg_op = 'DELETE' then
    v_is_demo := old.is_demo;
  else
    v_is_demo := new.is_demo;
  end if;
  if v_is_demo then
    return null;
  end if;

  if tg_op = 'DELETE' then
    v_tenant_id := old.tenant_id;
    v_delta := -pg_column_size(old);
  elsif tg_op = 'INSERT' then
    v_tenant_id := new.tenant_id;
    v_delta := pg_column_size(new);
  else
    v_tenant_id := new.tenant_id;
    v_delta := pg_column_size(new) - pg_column_size(old);
  end if;

  insert into public.tenant_usage (tenant_id, db_bytes_used, updated_at)
  values (v_tenant_id, greatest(0, v_delta), now())
  on conflict (tenant_id) do update
    set db_bytes_used = greatest(0, public.tenant_usage.db_bytes_used + v_delta),
        updated_at = now();

  return null;
end;
$$;

-- 스펙이 명시한 "품목, 매출/매입 전표, 거래처 원장"에 해당하는 테이블만
-- 붙인다 — 모든 테이블에 붙이면 사소한 조회성 테이블(예: 로그성 테이블)
-- 쓰기까지 매번 트리거가 돌아 불필요한 오버헤드가 생긴다. 더 늘릴
-- 필요가 생기면(예: work_orders) 같은 패턴으로 트리거만 추가하면 된다 —
-- bump_tenant_db_usage() 자체는 tenant_id 컬럼이 있는 어떤 테이블에도
-- 그대로 재사용 가능하다.
drop trigger if exists bump_tenant_db_usage on public.sales_orders;
create trigger bump_tenant_db_usage
  after insert or update or delete on public.sales_orders
  for each row execute function public.bump_tenant_db_usage();

drop trigger if exists bump_tenant_db_usage on public.purchase_orders;
create trigger bump_tenant_db_usage
  after insert or update or delete on public.purchase_orders
  for each row execute function public.bump_tenant_db_usage();

drop trigger if exists bump_tenant_db_usage on public.customers;
create trigger bump_tenant_db_usage
  after insert or update or delete on public.customers
  for each row execute function public.bump_tenant_db_usage();

drop trigger if exists bump_tenant_db_usage on public.suppliers;
create trigger bump_tenant_db_usage
  after insert or update or delete on public.suppliers
  for each row execute function public.bump_tenant_db_usage();

drop trigger if exists bump_tenant_db_usage on public.products;
create trigger bump_tenant_db_usage
  after insert or update or delete on public.products
  for each row execute function public.bump_tenant_db_usage();

-- 조회용 RPC. 퍼센트 계산까지 DB에서 끝내서, 프론트가 bigint/정수
-- 나눗셈을 잘못 다뤄 소수점이 깨지는 실수를 막는다. 쿼터가 0인
-- 비정상 상태(설정 실수)에서 0으로 나누기 에러가 나지 않도록
-- nullif로 방어한다.
create or replace function public.get_tenant_quota_status()
returns table (
  tenant_id uuid,
  db_bytes_used bigint,
  db_quota_bytes bigint,
  db_pct numeric,
  file_bytes_used bigint,
  file_quota_bytes bigint,
  file_pct numeric
)
language sql
security definer
set search_path = public
stable
as $$
  select
    t.id,
    coalesce(u.db_bytes_used, 0),
    t.db_quota_bytes,
    round(coalesce(u.db_bytes_used, 0)::numeric / nullif(t.db_quota_bytes, 0) * 100, 1),
    coalesce(u.file_bytes_used, 0),
    t.file_quota_bytes,
    round(coalesce(u.file_bytes_used, 0)::numeric / nullif(t.file_quota_bytes, 0) * 100, 1)
  from public.tenants t
  left join public.tenant_usage u on u.tenant_id = t.id
  where t.id = public.current_tenant_id();
$$;

revoke all on function public.get_tenant_quota_status() from public;
grant execute on function public.get_tenant_quota_status() to authenticated;

-- 파일 저장소(현재는 Supabase Storage, 추후 R2) 업로드/삭제 직후
-- 애플리케이션 코드가 호출해 증가/감소시키는 함수. DB 트리거와 달리
-- 파일 바이트 수는 Postgres 행에 담기지 않으므로(R2/Storage에만 존재)
-- 애플리케이션이 업로드 성공 직후 직접 알려줘야 한다 — 업로드 자체가
-- 실패하면 호출되지 않으므로 항상 "실제로 저장에 성공한 바이트"만
-- 반영된다.
create or replace function public.increment_tenant_file_usage(p_delta_bytes bigint)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid := public.current_tenant_id();
  v_new_bytes bigint;
begin
  if v_tenant_id is null then
    raise exception '소속 테넌트를 확인할 수 없습니다.';
  end if;

  insert into public.tenant_usage (tenant_id, file_bytes_used, updated_at)
  values (v_tenant_id, greatest(0, p_delta_bytes), now())
  on conflict (tenant_id) do update
    set file_bytes_used = greatest(0, public.tenant_usage.file_bytes_used + p_delta_bytes),
        updated_at = now()
  returning file_bytes_used into v_new_bytes;

  return v_new_bytes;
end;
$$;

revoke all on function public.increment_tenant_file_usage(bigint) from public;
grant execute on function public.increment_tenant_file_usage(bigint) to authenticated;

-- payment_request_receipts(migration 56)는 다른 첨부 테이블들
-- (messenger_messages.file_size, mail_attachments.size_bytes)과 달리
-- 파일 크기를 저장하지 않아, 삭제 시 파일 쿼터를 정확히 되돌릴 방법이
-- 없었다. 공용 업로드/삭제 래퍼(src/lib/storage/upload-attachment.ts)가
-- 모든 첨부 종류에서 이 값을 쓸 수 있도록 맞춘다. 기존 행은 null로
-- 남는다 — 이미 업로드된 파일을 다시 열어 크기를 재는 비용을 들이지
-- 않고, 새로 올라오는 영수증부터 정확히 집계한다(삭제 시 null이면
-- 0바이트로 간주해 그만큼만 과소 반영되고, 과다 차감되지는 않는다).
alter table public.payment_request_receipts add column if not exists size_bytes integer;

-- file_url이 not null이라(migration 56) R2로 저장되는 파일은 영구 공개
-- URL이 없어 이 컬럼을 비워둘 수 없었다 — R2 파일은 매번 짧게 만료되는
-- Presigned URL로만 조회해야 안전하므로, "업로드 시점에 영구 URL을
-- 저장해둔다"는 이 컬럼의 전제 자체가 R2에는 맞지 않는다. 지금 당장
-- R2로 전환하는 것은 아니지만(아래 upload-attachment.ts 참고 — 기존
-- 4개 업로드 지점은 당분간 계속 Supabase Storage를 쓰고, 읽기 쪽까지
-- Presigned URL로 바꾸는 건 후속 작업), 나중에 이 버킷을 R2로 옮길 때
-- not null 제약 때문에 또 마이그레이션을 거쳐야 하는 걸 미리 없애둔다.
alter table public.payment_request_receipts alter column file_url drop not null;

-- insert_payment_request_receipt(migration 81)에 size_bytes 저장 파라미터를
-- 추가한다. 파라미터 목록이 달라지는 변경이라 create or replace만으로는
-- 기존 4-파라미터 시그니처가 그대로 남아 중복 오버로드가 쌓인다
-- (migration 67/185에서 이미 두 번 겪은 문제) — 반드시 먼저 drop한다.
drop function if exists public.insert_payment_request_receipt(uuid, text, text, uuid);

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

  select coalesce(max(sort_order), -1) + 1
    into v_next
    from public.payment_request_receipts
    where payment_request_id = p_payment_request_id;

  insert into public.payment_request_receipts
    (payment_request_id, file_path, file_url, sort_order, created_by, size_bytes)
  values
    (p_payment_request_id, p_file_path, p_file_url, v_next, p_created_by, p_size_bytes)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.insert_payment_request_receipt(uuid, text, text, uuid, integer) from public;
grant execute on function public.insert_payment_request_receipt(uuid, text, text, uuid, integer) to authenticated;
