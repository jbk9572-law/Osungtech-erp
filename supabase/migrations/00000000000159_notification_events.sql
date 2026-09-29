-- 메신저/공지/결재 등 여러 화면에 흩어져 있던 알림 발송 로직을 하나로
-- 모으기 위한 "알림 이벤트" 저장소. 지금까지 타이틀바 알림 종은
-- get_notification_summary()가 매번 다시 계산하는 상태 기반 조회(안 읽은
-- 공지/마감 임박 할일/재고 부족)만 다뤘는데, 그건 "지금 상태가 어떤가"를
-- 묻는 것들이라 그대로 두고, 이 테이블은 "그 순간 실제로 벌어진 일"
-- (누군가 나에게 메시지를 보냈다, 결재가 왔다 등)을 이벤트 행 하나로
-- 남긴다 — 읽음 여부를 이벤트별로 추적할 수 있고, 나중에 메신저/메일과
-- 합쳐질 알림함 UI가 여기서 바로 조회할 수 있다.
--
-- 발송은 항상 src/lib/notify.ts의 notify() 하나를 거친다(직접 insert하는
-- 곳을 여러 군데 만들지 않는다). notify()는 관리자 클라이언트(service
-- role)로 이 테이블에 쓰는데, service role은 auth.uid()가 없어
-- tenant_id/is_demo 컬럼 기본값(public.current_tenant_id()/is_demo_actor())이
-- 제대로 계산되지 않는다 — 그래서 notify()는 호출자의 일반 클라이언트로
-- 먼저 tenant_id/is_demo를 구해서 매번 명시적으로 넘긴다(mail_accounts 등
-- 이미 이 방식을 쓰는 테이블과 같은 이유).
create table if not exists public.notification_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  is_demo boolean not null default public.is_demo_actor(),
  -- 알림을 받는 사람. sender_id는 두지 않는다 — "누가 보냈는지"는
  -- title/body 문구 안에 이미 사람 이름을 넣어 표현하고, 이 테이블은
  -- 수신자 관점의 읽음 여부 추적에만 집중한다.
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- 자유 문자열 — 새 알림 종류를 추가할 때마다 마이그레이션으로 체크
  -- 제약을 넓힐 필요 없게 한다(현재: messenger_dm, messenger_group,
  -- announcement, approval_pending, approval_result — 계속 늘어날 수 있음).
  type text not null,
  title text not null,
  body text not null default '',
  url text not null default '/',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notification_events_user_id_created_at_idx
  on public.notification_events (user_id, created_at desc);
create index if not exists notification_events_tenant_id_idx on public.notification_events (tenant_id);

alter table public.notification_events enable row level security;

-- 아래 정책들은 재실행 가능하도록 먼저 지우고 다시 만든다(이 저장소의
-- 기존 마이그레이션들과 같은 관례 — 예: 00000000000099).
drop policy if exists "notification_events_tenant_isolation" on public.notification_events;
create policy "notification_events_tenant_isolation" on public.notification_events
  as restrictive for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());
drop policy if exists "notification_events_demo_isolation" on public.notification_events;
create policy "notification_events_demo_isolation" on public.notification_events
  as restrictive for all
  using (is_demo = public.is_demo_actor())
  with check (is_demo = public.is_demo_actor());

-- 본인 몫만 조회/읽음처리/삭제할 수 있다. insert 정책은 일부러 안
-- 만든다 — 알림은 항상 notify()가 관리자 클라이언트(RLS 우회)로만
-- 쓰고, 사용자가 자기 자신 앞으로 알림을 직접 끼워넣을 이유가 없다.
drop policy if exists "notification_events_select_own" on public.notification_events;
create policy "notification_events_select_own" on public.notification_events
  for select using (auth.role() = 'authenticated' and user_id = auth.uid());
drop policy if exists "notification_events_update_own" on public.notification_events;
create policy "notification_events_update_own" on public.notification_events
  for update
  using (auth.role() = 'authenticated' and user_id = auth.uid())
  with check (auth.role() = 'authenticated' and user_id = auth.uid());
drop policy if exists "notification_events_delete_own" on public.notification_events;
create policy "notification_events_delete_own" on public.notification_events
  for delete using (auth.role() = 'authenticated' and user_id = auth.uid());
