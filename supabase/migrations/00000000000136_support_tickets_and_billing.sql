-- 고객지원 채널 + 구독/결제 화면에 쓸 최소 스키마.
--
-- 고객지원: 지금까지는 문제가 생기면 연락할 방법 자체가 없었다. 완전한
-- 헬프데스크(카테고리 분류, SLA, 첨부파일 등)까지는 필요 없고, "회사가
-- 문의를 남기면 플랫폼 운영자가 보고 답한다"는 가장 단순한 형태로
-- 시작한다 — 이미 있는 platform_announcements(플랫폼 -> 전체 테넌트
-- 단방향 공지)와 정반대 방향(테넌트 -> 플랫폼)의 소통 채널이다.
--
-- 구독/결제: 지금은 무료로 배포하고 실제 결제(PG) 연동은 나중에 붙일
-- 예정이라, 이 마이그레이션에서는 결제 수단/청구 내역 같은 테이블은
-- 만들지 않는다 — tenants.plan/plan_expires_at(migration 122~123)과
-- platform_plans(migration 129)만으로 "지금 어떤 요금제를 쓰고 있는지"
-- 보여주는 화면은 이미 충분히 만들 수 있고, 실제 결제를 붙일 때 그
-- 시점에 필요한 테이블을 새로 추가하는 게 낫다(지금 미리 만들면 실제
-- PG사 API 응답 구조에 안 맞아 다시 갈아엎을 가능성이 높다).

create sequence public.support_tickets_doc_no_seq;

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  doc_no bigint not null default nextval('public.support_tickets_doc_no_seq'),
  subject text not null,
  message text not null,
  status text not null default 'open' check (status in ('open', 'answered', 'closed')),
  reply text,
  replied_at timestamptz,
  replied_by uuid references auth.users (id) on delete set null,
  is_demo boolean not null default public.is_demo_actor(),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index support_tickets_tenant_id_idx on public.support_tickets (tenant_id, created_at desc);

alter table public.support_tickets enable row level security;

-- 일반 테넌트 사용자는 자기 회사(테넌트) 문의만 보고 만들 수 있다 —
-- sales_orders 등과 동일한 tenant_id/is_demo 이중 RESTRICTIVE 패턴.
create policy "support_tickets_tenant_isolation" on public.support_tickets
  as restrictive
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy "support_tickets_demo_isolation" on public.support_tickets
  as restrictive
  for all
  using (is_demo = public.is_demo_actor())
  with check (is_demo = public.is_demo_actor());

create policy "support_tickets_select_authenticated" on public.support_tickets
  for select using (auth.role() = 'authenticated');
create policy "support_tickets_insert_authenticated" on public.support_tickets
  for insert with check (auth.role() = 'authenticated');

-- 플랫폼 운영자는 위 tenant_isolation RESTRICTIVE 정책 때문에 그대로는
-- 다른 회사의 문의를 못 본다 — activity-log(migration 129)와 같은
-- 이유로, 플랫폼 운영자에게는 그 정책을 우회하는 별도 RESTRICTIVE
-- 정책을 OR로 얹어야 한다. RESTRICTIVE는 같은 이름의 정책끼리는 AND,
-- 다른 이름끼리도 AND이므로 "테넌트 격리이거나 플랫폼 운영자이거나"를
-- 표현하려면 tenant_isolation 정책 자체에 조건을 추가해야 한다.
drop policy "support_tickets_tenant_isolation" on public.support_tickets;
create policy "support_tickets_tenant_isolation" on public.support_tickets
  as restrictive
  for all
  using (tenant_id = public.current_tenant_id() or public.is_platform_admin())
  with check (tenant_id = public.current_tenant_id() or public.is_platform_admin());

-- 답변(reply/status)은 플랫폼 운영자만 남길 수 있다 — 일반 사용자의
-- update authenticated 정책을 따로 열어주지 않고, 이 함수 하나로만
-- 답변을 달 수 있게 한다(security definer로 권한 체크 후 갱신).
create or replace function public.reply_support_ticket(
  p_id uuid,
  p_reply text,
  p_status text default 'answered'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception '플랫폼 운영자만 답변할 수 있습니다.';
  end if;
  if p_status not in ('answered', 'closed') then
    raise exception '잘못된 상태값입니다.';
  end if;

  update public.support_tickets
  set reply = p_reply, status = p_status, replied_at = now(), replied_by = auth.uid()
  where id = p_id;
end;
$$;

revoke all on function public.reply_support_ticket(uuid, text, text) from public;
grant execute on function public.reply_support_ticket(uuid, text, text) to authenticated;
