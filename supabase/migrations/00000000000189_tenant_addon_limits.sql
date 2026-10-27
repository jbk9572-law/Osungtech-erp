-- 2026-10-27 기획서("B2B SaaS 요금제 및 애드온 데이터 구조 설계안")의
-- "확장 애드온" 항목을 수동 관리 단계에 맞게 반영한다.
--
-- 기획서는 plans(카탈로그)/tenant_subscriptions(구독+애드온) 두 테이블로
-- 나누자고 제안했지만, 이 프로젝트는 migration 153/186에서 이미 같은
-- 고민을 했고 "카탈로그(platform_plans) vs 실제 계약 상태(tenants)"로
-- 나누는 쪽을 택했다 — 쿼터 숫자는 업체마다 수동 조정이 필요해서
-- platform_plans가 아니라 tenants에 직접 둔다. migration 186의 주석이
-- 이미 "애드온 패키지를 자동 결제로 파는 단계가 오면 그때 '구매한
-- 애드온 내역' 테이블을 얹는 게 맞다"고 못박아뒀는데, 기획서 1번
-- 항목도 "초기 개발 단계에서는 결제 연동 없이"라고 명시하므로 아직 그
-- 단계가 아니다 — 지금은 그 전 단계 그대로, tenants에 최종 숫자
-- 컬럼만 추가한다(기획서의 tenant_subscriptions.add_on_extra_* 같은
-- "애드온 구매 내역" 테이블은 실제 PG 결제가 붙는 시점에 추가).
--
-- 외주처(협력사) 연동 기본 1개사, 월 이메일 발송 100건, 자사 도메인
-- 메일 애드온 — DB/파일 저장소 쿼터(이미 있음, migration 186)와 같은
-- 선상의 세 가지를 추가한다. 팩스 발송 건수 쿼터(monthly_fax_quota)는
-- 이미 있어 그대로 쓴다.
alter table public.tenants add column if not exists vendor_limit integer not null default 1;
alter table public.tenants add column if not exists monthly_email_quota integer not null default 100;
alter table public.tenants add column if not exists custom_domain_mail boolean not null default false;

-- 월간 리셋되는 소모성 사용량(이메일/팩스 발송 건수) — DB/파일 용량
-- (tenant_usage, 누적 스냅샷)과 성격이 달라 별도 테이블로 둔다. 매달
-- 1일 자동 리셋(기획서 2번 항목)을 "리셋 작업"으로 처리하지 않고,
-- (tenant_id, year_month) 복합키로 달마다 새 행을 만드는 방식으로
-- 구현한다 — 리셋 배치 작업이 없어도 되고, 지난달 사용량 이력도
-- 저절로 남는다.
create table if not exists public.tenant_monthly_usage (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  year_month text not null, -- 'YYYY-MM' (Asia/Seoul 기준)
  email_sent_count integer not null default 0,
  fax_sent_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, year_month)
);

alter table public.tenant_monthly_usage enable row level security;

create policy "tenant_monthly_usage_select_own" on public.tenant_monthly_usage
  for select using (tenant_id = public.current_tenant_id());

-- 메일 발송(src/app/(dashboard)/mail/actions.ts의 sendMailAction) 성공
-- 직후 애플리케이션 코드가 호출한다 — increment_tenant_file_usage()와
-- 같은 패턴(SECURITY DEFINER, 발송 자체가 실패하면 호출 안 됨 → 항상
-- 실제 발송 성공분만 집계). 팩스는 아직 실제 발행 API가 없어(migration
-- 186 주석과 같은 이유) 카운트만 테이블에 자리를 만들어두고 증가시키는
-- 코드는 아직 없다 — 실제 팩스 API가 붙는 시점에 같은 패턴으로 추가.
create or replace function public.increment_tenant_email_usage()
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

  -- 데모 계정이 연습으로 보내는 메일은 실제 회사의 무료 건수를
  -- 깎아먹으면 안 된다(bump_tenant_db_usage와 같은 전제 — migration 85).
  if public.is_demo_actor() then
    return 0;
  end if;

  insert into public.tenant_monthly_usage (tenant_id, year_month, email_sent_count)
  values (v_tenant_id, v_year_month, 1)
  on conflict (tenant_id, year_month) do update
    set email_sent_count = public.tenant_monthly_usage.email_sent_count + 1,
        updated_at = now()
  returning email_sent_count into v_new_count;

  return v_new_count;
end;
$$;

revoke all on function public.increment_tenant_email_usage() from public;
grant execute on function public.increment_tenant_email_usage() to authenticated;
