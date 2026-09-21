-- 1) 요금제 이용기간. plan(체험/정상 이용/이용 중지) 라벨과는 별개로,
--    실제 로그인 차단 기준이 되는 만료일을 둔다 — plan_expires_at이
--    지나면 disabled_at과 동일하게 로그인 자체를 막는다(이용기간이
--    "장식용 날짜"에 그치지 않도록).
alter table public.tenants add column if not exists plan_started_at timestamptz;
alter table public.tenants add column if not exists plan_expires_at timestamptz;

-- 2) 포인트. 지금은 세금계산서/계산서 발행이 전부 수기 표시라 실제로
--    깎을 곳이 없다 — 나중에 팝빌/바로빌 같은 실제 발행 API나 알림톡/팩스
--    기능을 붙일 때 그 호출 지점에서 이 잔액을 깎게 될 것을 미리
--    준비해두는 것. action_type을 고정된 값으로 제한하지 않고 자유
--    텍스트로 둬서, 나중에 소모 유형이 늘어나도 마이그레이션 없이
--    바로 쓸 수 있게 한다.
alter table public.tenants add column if not exists points_balance integer not null default 0;

create table if not exists public.point_transactions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  delta integer not null,
  action_type text,
  reason text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists point_transactions_tenant_id_idx on public.point_transactions (tenant_id);

alter table public.point_transactions enable row level security;
-- 플랫폼 운영자(service_role 관리자 클라이언트)만 다루는 화면이라 별도
-- select/insert 정책이 없어도 된다 — RLS를 켜두는 것만으로 일반
-- authenticated 세션의 직접 접근은 기본 차단된다.

-- 잔액 갱신 + 내역 기록을 한 트랜잭션으로 묶는 함수. 두 단계(잔액 읽고
-- 갱신 / 내역 insert)를 애플리케이션에서 따로 하면 동시에 두 명이
-- 조정할 때 잔액이 어긋날 수 있어, DB 함수 안에서 원자적으로 처리한다.
create or replace function public.adjust_tenant_points(
  p_tenant_id uuid,
  p_delta integer,
  p_action_type text,
  p_reason text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_balance integer;
begin
  update public.tenants
  set points_balance = points_balance + p_delta
  where id = p_tenant_id
  returning points_balance into v_new_balance;

  if v_new_balance is null then
    raise exception '테넌트를 찾을 수 없습니다.';
  end if;

  insert into public.point_transactions (tenant_id, delta, action_type, reason, created_by)
  values (p_tenant_id, p_delta, p_action_type, p_reason, auth.uid());

  return v_new_balance;
end;
$$;

revoke all on function public.adjust_tenant_points(uuid, integer, text, text) from public, anon, authenticated;
grant execute on function public.adjust_tenant_points(uuid, integer, text, text) to service_role;

-- 3) 로그인 차단 사유를 하나로 합친다. 122에서 만든
--    is_login_tenant_disabled()는 "비활성화"만 봤는데, 여기에 "이용기간
--    만료"까지 같이 판단하면서 어떤 사유인지 구분해서 돌려주도록
--    boolean 대신 text를 반환하게 바꾼다(화면 안내 문구를 다르게
--    보여주기 위함 — 관리자에 의해 막힌 것과 계약 기간이 끝난 것은
--    사용자 입장에서 다음 행동이 다르다).
drop function if exists public.is_login_tenant_disabled(text);

create or replace function public.get_login_block_reason(p_username text)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select case
    when t.disabled_at is not null then 'disabled'
    when t.plan_expires_at is not null and t.plan_expires_at < now() then 'expired'
    else null
  end
  from public.profiles p
  join public.tenants t on t.id = p.tenant_id
  where p.username = p_username;
$$;

revoke all on function public.get_login_block_reason(text) from public, anon, authenticated;
grant execute on function public.get_login_block_reason(text) to service_role;
