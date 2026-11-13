-- 메신저 "안 읽은 대화" 저장 — 지금까지는 안 읽음 표시가 메신저 화면을 열어 둔 동안 브라우저 안에서만
-- 계산됐다(다른 화면에서는 알 수 없음). 메인 화면의 "메신저" 탭이 정확한 개수를 보여주려면 사람×채널별로
-- "마지막으로 읽은 시각"을 서버에 저장해야 한다. "전체" 채널은 멤버 행이 없으므로(is_messenger_channel_member
-- 참고) 멤버 테이블에 컬럼을 더하지 않고 별도 테이블을 쓴다.
--
-- 읽음 행이 아직 없는 채널은 "이 기능이 켜진 시각(또는 내 계정 생성 시각 중 늦은 쪽)"부터 온 메시지만 안 읽음으로
-- 센다 — 배포 직후 지난 대화가 전부 안 읽음으로 쏟아지지 않게.
create table if not exists public.messenger_channel_reads (
  channel_id uuid not null references public.messenger_channels (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  is_demo boolean not null default public.is_demo_actor(),
  last_read_at timestamptz not null default now(),
  primary key (channel_id, user_id)
);

create index if not exists messenger_channel_reads_user_id_idx on public.messenger_channel_reads (user_id);
create index if not exists messenger_channel_reads_tenant_id_idx on public.messenger_channel_reads (tenant_id);

alter table public.messenger_channel_reads enable row level security;

create policy "messenger_channel_reads_tenant_isolation" on public.messenger_channel_reads
  as restrictive
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy "messenger_channel_reads_demo_isolation" on public.messenger_channel_reads
  as restrictive
  for all
  using (is_demo = public.is_demo_actor())
  with check (is_demo = public.is_demo_actor());

-- 내 읽음 기록만 볼 수 있다. 쓰기는 아래 RPC로만(직접 insert/update 정책을 열지 않는다).
create policy "messenger_channel_reads_select_own" on public.messenger_channel_reads
  for select using (user_id = auth.uid());

create or replace function public.mark_messenger_channel_read(p_channel_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 내가 볼 수 있는 채널이 아니면 조용히 아무 일도 하지 않는다(남의 채널에 읽음 행을 만들 수 없게).
  if auth.uid() is null or not public.is_messenger_channel_member(p_channel_id) then
    return;
  end if;
  insert into public.messenger_channel_reads (channel_id, user_id, last_read_at)
  values (p_channel_id, auth.uid(), now())
  on conflict (channel_id, user_id) do update set last_read_at = excluded.last_read_at;
end;
$$;

revoke all on function public.mark_messenger_channel_read(uuid) from public;
grant execute on function public.mark_messenger_channel_read(uuid) to authenticated;

-- 채널별 가장 최근 "안 읽은" 메시지와 안 읽은 개수 — 최근순 최대 20개 채널. security invoker라서 메시지 RLS가
-- 그대로 적용된다(내가 볼 수 있는 채널의 메시지만 센다). 내가 보낸 메시지는 안 읽음이 아니다.
create or replace function public.get_messenger_unread(p_limit int default 8)
returns table (channel_id uuid, channel_label text, last_sender_name text, last_content text, last_at timestamptz, unread_count bigint)
language sql
stable
set search_path = public
as $$
  with me as (
    select auth.uid() as uid, (select pr.created_at from public.profiles pr where pr.id = auth.uid()) as since
  ),
  unread as (
    select m.channel_id, m.sender_id, m.content, m.created_at,
           row_number() over (partition by m.channel_id order by m.created_at desc) as rn,
           count(*) over (partition by m.channel_id) as cnt
    from public.messenger_messages m
    cross join me
    left join public.messenger_channel_reads r on r.channel_id = m.channel_id and r.user_id = me.uid
    where m.sender_id is distinct from me.uid
      and m.created_at > coalesce(r.last_read_at, greatest(me.since, timestamptz '2026-11-13 06:00:00+00'))
  )
  select u.channel_id,
         case c.type
           when 'all' then '전체'
           when 'group' then coalesce(c.name, '그룹')
           else coalesce(
             (select p2.full_name from public.messenger_channel_members mm
                join public.profiles p2 on p2.id = mm.user_id
               where mm.channel_id = c.id and mm.user_id <> auth.uid() limit 1),
             'DM')
         end,
         p.full_name, u.content, u.created_at, u.cnt
  from unread u
  join public.messenger_channels c on c.id = u.channel_id
  left join public.profiles p on p.id = u.sender_id
  where u.rn = 1
  order by u.created_at desc
  limit greatest(1, least(coalesce(p_limit, 8), 20));
$$;

grant execute on function public.get_messenger_unread(int) to authenticated;
