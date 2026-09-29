-- 메신저/공지/결재 등 여러 화면에 흩어져 있던 알림 발송 로직을 하나로
-- 모으기 위한 "알림 이벤트" 저장소. 지금까지 타이틀바 알림 종은
-- get_notification_summary()가 매번 다시 계산하는 상태 기반 조회(안 읽은
-- 공지/마감 임박 할일/재고 부족)만 다뤘는데, 그건 "지금 상태가 어떤가"를
-- 묻는 것들이라 그대로 두고, 이 테이블은 "그 순간 실제로 벌어진 일"
-- (누군가 나에게 메시지를 보냈다, 결재가 왔다 등)을 이벤트 행 하나로
-- 남긴다 — 읽음 여부를 이벤트별로 추적할 수 있고, 나중에 메신저/메일과
-- 합쳐질 알림함 UI가 여기서 바로 조회할 수 있다.
--
-- 발송은 항상 src/lib/notify.ts의 notify()/notifyForTenant()를 거친다
-- (직접 insert하는 곳을 여러 군데 만들지 않는다). notify()는 관리자
-- 클라이언트(service role)로 이 테이블에 쓰는데, service role은
-- auth.uid()가 없어 tenant_id/is_demo 컬럼 기본값(public.current_tenant_id()/
-- is_demo_actor())이 제대로 계산되지 않는다 — 그래서 notify()는 호출자의
-- 일반 클라이언트로 먼저 tenant_id/is_demo를 구해서 매번 명시적으로
-- 넘기고, 세션이 아예 없는 크론 호출(notifyForTenant, 메일 동기화 등)은
-- 그 계정 행이 이미 갖고 있는 tenant_id/is_demo를 그대로 넘긴다
-- (mail_accounts 등 이미 이 방식을 쓰는 테이블과 같은 이유).
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
  -- announcement, approval_pending, approval_result, mail — 계속 늘어날 수 있음).
  type text not null,
  title text not null,
  body text,
  url text,
  -- 이 알림이 가리키는 원본 행의 id(메시지/공지/결재문서 등) — url만으로
  -- 충분히 이동 가능해서 지금은 화면에서 직접 쓰지 않지만, 나중에 같은
  -- 원본에 대한 알림을 합쳐 보여주거나 원본이 삭제됐을 때 알림도 같이
  -- 정리하는 데 쓸 수 있어 컬럼만 미리 갖고 있는다.
  source_id uuid,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- 이 테이블이 이번 마이그레이션 이전에 이미 만들어져 있던 경우(is_demo
-- 컬럼 없이) 뒤늦게 컬럼을 추가하고 프로필 기준으로 값을 채운다 — 새로
-- 만드는 설치에서는 위 create table에 이미 포함돼 있어 아무 효과 없다.
alter table public.notification_events add column if not exists is_demo boolean not null default false;
update public.notification_events ne
  set is_demo = coalesce(p.is_demo, false)
  from public.profiles p
  where p.id = ne.user_id and ne.is_demo is distinct from coalesce(p.is_demo, false);
alter table public.notification_events alter column is_demo set default public.is_demo_actor();

create index if not exists notification_events_user_id_created_at_idx
  on public.notification_events (user_id, created_at desc);
create index if not exists notification_events_tenant_id_idx on public.notification_events (tenant_id);
-- "안 읽은 알림 개수" 조회(알림함 배지)가 항상 이 조건으로 걸릴 것이므로
-- 부분 인덱스로 좁혀둔다.
create index if not exists notification_events_user_id_unread_idx
  on public.notification_events (user_id) where not is_read;

alter table public.notification_events enable row level security;

-- 아래 정책들은 재실행 가능하도록 먼저 지우고 다시 만든다(이 저장소의
-- 기존 마이그레이션들과 같은 관례 — 예: 00000000000099). 이 테이블이
-- 미리 만들어져 있었다면 그때 다른 이름으로 정책이 생겼을 수 있는데,
-- 이름이 다르면 이 drop이 못 지우므로 남아있을 수 있다 — pg_policies로
-- 확인해서 이 마이그레이션의 정책과 겹치거나 더 넓게 허용하는 옛 정책이
-- 있으면 수동으로 정리해야 한다.
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
-- 만든다 — 알림은 항상 notify()/notifyForTenant()가 관리자 클라이언트
-- (RLS 우회)로만 쓰고, 사용자가 자기 자신 앞으로 알림을 직접 끼워넣을
-- 이유가 없다.
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
