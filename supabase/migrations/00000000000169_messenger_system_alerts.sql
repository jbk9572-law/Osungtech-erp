-- 안전재고부족·할일 마감임박/지연 알림이 타이틀바 종(알림 종)과 메신저
-- 둘 다에서 "뭔가 확인해야 한다"는 같은 역할을 중복해서 하고 있었다 —
-- 종 드롭다운/토스트 팝업은 그대로 두되 두 항목은 빼고(코드 쪽에서
-- 처리), 대신 다들 평소에 열어두는 그룹웨어 메신저 "전체" 채널에
-- "시스템봇"(sender_id = null, 거래처 포털 발주 알림과 같은 패턴,
-- src/app/portal/(app)/new/actions.ts 참고)이 올리게 한다.
--
-- 크론(5분 주기 GitHub Actions, 이 배포 방식은 Cloudflare Cron Trigger를
-- 못 써서 mail-sync와 같은 이유로 GitHub Actions를 쓴다)이 주기적으로
-- 돌며 조건을 감지해서 올리는데, 매번 돌 때마다 같은 알림을 또 올리면
-- 스팸이 되므로 "이미 올린 것"을 추적하는 테이블이 필요하다. 조건이
-- 해소되면(재입고, 할일 완료/마감일 변경) 그 추적 행을 지워서, 나중에
-- 같은 조건이 다시 생기면 다시 알릴 수 있게 한다.
create table if not exists public.messenger_system_alert_state (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  is_demo boolean not null,
  alert_type text not null check (alert_type in ('low_stock', 'todo_due')),
  source_id uuid not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, is_demo, alert_type, source_id)
);
create index if not exists messenger_system_alert_state_tenant_idx
  on public.messenger_system_alert_state (tenant_id, is_demo);

-- 이 테이블은 크론(서비스 롤, RLS 완전 우회)만 읽고 쓴다 — 일반 사용자가
-- 볼 이유가 없는 순수 내부 중복방지용 장부라 permissive 정책을 열지
-- 않는다(RLS는 켜둬서 혹시 모를 직접 접근을 기본 차단).
alter table public.messenger_system_alert_state enable row level security;
