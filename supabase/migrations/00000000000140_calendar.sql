-- 회사 공유 캘린더: 회의/기타 일정을 직접 등록하고, 승인된 연차는 자동으로
-- 같이 보여준다(레코드를 복제하지 않고 화면/피드 조회 시점에 합친다 —
-- src/lib/calendar-data.ts 참고). 공지사항(announcements)은 tenant_id 컬럼이
-- 아예 없는 예전 테이블이라(멀티테넌트 이전 유산) 여기 합치면 ICS 구독
-- 피드로 다른 회사 공지까지 새어나갈 위험이 있어 이번 범위에서는 뺐다.

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  is_demo boolean not null default public.is_demo_actor(),
  title text not null,
  description text not null default '',
  location text not null default '',
  start_at timestamptz not null,
  end_at timestamptz not null,
  all_day boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calendar_events_time_order check (end_at >= start_at)
);

create index calendar_events_tenant_start_idx on public.calendar_events (tenant_id, start_at);

alter table public.calendar_events enable row level security;

create policy "calendar_events_tenant_isolation" on public.calendar_events
  as restrictive for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());
create policy "calendar_events_demo_isolation" on public.calendar_events
  as restrictive for all
  using (is_demo = public.is_demo_actor())
  with check (is_demo = public.is_demo_actor());

-- 같은 회사 구성원 전체가 봐야 "공유" 캘린더로서 의미가 있다.
create policy "calendar_events_select_authenticated" on public.calendar_events
  for select
  using (auth.role() = 'authenticated');

create policy "calendar_events_insert_own" on public.calendar_events
  for insert
  with check (auth.role() = 'authenticated' and created_by = auth.uid());

create policy "calendar_events_update_own_or_admin" on public.calendar_events
  for update
  using (created_by = auth.uid() or public.is_admin());

create policy "calendar_events_delete_own_or_admin" on public.calendar_events
  for delete
  using (created_by = auth.uid() or public.is_admin());

-- ICS 구독 URL에 쓰는 개인별 비밀 토큰. profiles 테이블은 같은 회사 전체가
-- 서로 조회 가능한 permissive 정책(profiles_select_authenticated)이 있어서,
-- 이 토큰을 profiles 컬럼으로 두면 같은 회사 동료가 남의 구독 URL을 그대로
-- 읽어갈 수 있다 — 그래서 본인만 조회/수정 가능한 별도 테이블로 둔다.
create table public.calendar_feed_tokens (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  is_demo boolean not null default public.is_demo_actor(),
  token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create unique index calendar_feed_tokens_token_idx on public.calendar_feed_tokens (token);

alter table public.calendar_feed_tokens enable row level security;

create policy "calendar_feed_tokens_tenant_isolation" on public.calendar_feed_tokens
  as restrictive for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());
create policy "calendar_feed_tokens_demo_isolation" on public.calendar_feed_tokens
  as restrictive for all
  using (is_demo = public.is_demo_actor())
  with check (is_demo = public.is_demo_actor());

create policy "calendar_feed_tokens_own" on public.calendar_feed_tokens
  for all
  using (auth.role() = 'authenticated' and user_id = auth.uid())
  with check (auth.role() = 'authenticated' and user_id = auth.uid());

-- 화면(/calendar)이 처음 열릴 때 구독 URL을 바로 보여줄 수 있도록, 없으면
-- 만들고 있으면 그대로 돌려준다.
create or replace function public.get_or_create_calendar_feed_token()
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_token uuid;
begin
  insert into public.calendar_feed_tokens (user_id)
  values (auth.uid())
  on conflict (user_id) do nothing;

  select token into v_token from public.calendar_feed_tokens where user_id = auth.uid();
  return v_token;
end;
$$;

revoke all on function public.get_or_create_calendar_feed_token() from public;
grant execute on function public.get_or_create_calendar_feed_token() to authenticated;

-- 구독 URL이 유출됐을 때 기존 URL을 무효화하고 새로 받을 수 있는 재발급.
create or replace function public.regenerate_calendar_feed_token()
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_token uuid := gen_random_uuid();
begin
  insert into public.calendar_feed_tokens (user_id, token)
  values (auth.uid(), v_token)
  on conflict (user_id) do update set token = excluded.token;
  return v_token;
end;
$$;

revoke all on function public.regenerate_calendar_feed_token() from public;
grant execute on function public.regenerate_calendar_feed_token() to authenticated;
