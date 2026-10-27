-- "요금제 제한에 팩스는 있는데 계산서/알림톡(문자)이 빠졌다"는 지적
-- 반영. 계산서 쿼터 컬럼(tenants.monthly_tax_invoice_quota, 기본 100건)
-- 자체는 이미 migration 186에서 만들어뒀는데 — 그 주석이 "실제 발행
-- API가 안 붙어있어 소모시킬 지점이 없다"고 적어둔 바로 그 컬럼이다 —
-- 그 뒤로 아무도 실제로 깎는 코드를 안 붙여서 "쿼터가 있어도 세는
-- 곳이 없는" 상태였다. 새 컬럼을 또 만들지 않고 그 컬럼을 그대로
-- 쓰면서, 지금 바로 실제 발행 지점(createTaxInvoice/
-- createTaxInvoiceCorrection/bulk-create)에 카운터를 연결한다.
--
-- 알림톡/문자(SMS)는 반대로 쿼터 컬럼조차 없었다 — 실제 발송 기능
-- 자체가 코드베이스에 전혀 없어서다. 팩스(migration 189)와 같은
-- 이유로 쿼터 "자리"만 만들어두고(기본값 0 — 아직 안 쓰는 애드온이라는
-- 뜻), 실제 발송 API가 붙는 시점에 increment_tenant_email_usage와
-- 같은 패턴으로 증가 함수를 추가한다.
alter table public.tenants add column if not exists monthly_alimtalk_quota integer not null default 0;

alter table public.tenant_monthly_usage add column if not exists invoice_issued_count integer not null default 0;
alter table public.tenant_monthly_usage add column if not exists alimtalk_sent_count integer not null default 0;

alter table public.platform_plans add column if not exists included_invoice_quota integer;
alter table public.platform_plans add column if not exists included_alimtalk_quota integer;

update public.platform_plans
set included_invoice_quota = coalesce(included_invoice_quota, 100)
where plan_key = 'standard';

create or replace function public.increment_tenant_invoice_usage()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid := public.current_tenant_id();
  v_year_month text := to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM');
  v_new_count integer;
begin
  if v_tenant_id is null then
    raise exception '소속 테넌트를 확인할 수 없습니다.';
  end if;

  if public.is_demo_actor() then
    return 0;
  end if;

  insert into public.tenant_monthly_usage (tenant_id, year_month, invoice_issued_count)
  values (v_tenant_id, v_year_month, 1)
  on conflict (tenant_id, year_month) do update
    set invoice_issued_count = public.tenant_monthly_usage.invoice_issued_count + 1,
        updated_at = now()
  returning invoice_issued_count into v_new_count;

  return v_new_count;
end;
$$;

revoke all on function public.increment_tenant_invoice_usage() from public;
grant execute on function public.increment_tenant_invoice_usage() to authenticated;

-- 통계 화면의 "테넌트별 발송량"에서 쓴다 — 이번 달 메일/팩스/계산서/
-- 알림톡 발송 건수를 테넌트별로 한 번에 돌려준다(없는 테넌트는 0으로
-- 채움, tenant_monthly_usage는 실제 발송이 있어야 행이 생기는 구조라
-- left join 필요).
create or replace function public.get_platform_monthly_usage_breakdown()
returns table (
  tenant_id uuid,
  tenant_name text,
  email_sent_count integer,
  fax_sent_count integer,
  invoice_issued_count integer,
  alimtalk_sent_count integer
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_platform_admin() then
    raise exception '플랫폼 운영자만 조회할 수 있습니다.';
  end if;

  return query
  select
    t.id,
    t.name,
    coalesce(u.email_sent_count, 0),
    coalesce(u.fax_sent_count, 0),
    coalesce(u.invoice_issued_count, 0),
    coalesce(u.alimtalk_sent_count, 0)
  from public.tenants t
  left join public.tenant_monthly_usage u
    on u.tenant_id = t.id and u.year_month = to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM')
  order by t.name;
end;
$$;

revoke all on function public.get_platform_monthly_usage_breakdown() from public;
grant execute on function public.get_platform_monthly_usage_breakdown() to authenticated;
