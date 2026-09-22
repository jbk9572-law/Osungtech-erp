-- 전자결재 요청/승인/반려 시 브라우저 푸시 알림을 보내기 위한 구독 저장소.
-- 실제 발송(Web Push)은 서버 액션에서 web-push 패키지로 하고, 이 테이블은
-- "이 사용자가 이 브라우저에서 알림을 받기로 했다"는 구독 정보만 갖는다.
-- 기기/브라우저 하나당 구독이 하나라(endpoint가 브라우저-사이트 조합별로
-- 고유), 같은 사람이 여러 기기에서 켜면 여러 행이 쌓인다 — 발송 시 그
-- 사람의 모든 구독에 전부 보낸다.

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  is_demo boolean not null default public.is_demo_actor(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index push_subscriptions_user_id_idx on public.push_subscriptions (user_id);
create index push_subscriptions_tenant_id_idx on public.push_subscriptions (tenant_id);

alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions_tenant_isolation" on public.push_subscriptions
  as restrictive for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());
create policy "push_subscriptions_demo_isolation" on public.push_subscriptions
  as restrictive for all
  using (is_demo = public.is_demo_actor())
  with check (is_demo = public.is_demo_actor());

-- 본인 구독만 등록/조회/삭제(해지) 가능 — 다른 사람 몫으로 알림을 켜거나
-- 끌 수 없다.
create policy "push_subscriptions_own" on public.push_subscriptions
  for all
  using (auth.role() = 'authenticated' and user_id = auth.uid())
  with check (auth.role() = 'authenticated' and user_id = auth.uid());

-- 발송은 서버 액션이 sender(admin client, service_role)로 하므로 이
-- 테이블을 다른 사용자 몫까지 조회할 일이 없다 — RLS를 우회하는 별도
-- select 정책은 필요 없다.
