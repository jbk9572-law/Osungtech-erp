-- 메신저 보강 — (1) 방별 알림 끄기: 끈 방은 메인 화면 "메신저" 개수와 푸시 알림에서 빠진다(메신저 화면에는 그대로 보인다).
-- 읽음 행(messenger_channel_reads, 236)에 muted 컬럼만 더한다 — 사람×채널당 이미 한 행이라 별도 테이블이 필요 없다.
-- (2) 시스템 자동 알림(보낸 사람 없음, 예: 미수금 연체 알림)은 안 읽은 개수에서 뺀다 — 사람이 보낸 대화만 센다.
alter table public.messenger_channel_reads add column if not exists muted boolean not null default false;

create or replace function public.set_messenger_channel_muted(p_channel_id uuid, p_muted boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_messenger_channel_member(p_channel_id) then
    return;
  end if;
  insert into public.messenger_channel_reads (channel_id, user_id, last_read_at, muted)
  values (p_channel_id, auth.uid(), now(), coalesce(p_muted, false))
  on conflict (channel_id, user_id) do update set muted = excluded.muted;
end;
$$;

revoke all on function public.set_messenger_channel_muted(uuid, boolean) from public;
grant execute on function public.set_messenger_channel_muted(uuid, boolean) to authenticated;

-- 푸시를 보낼 때 "알림을 끈 사람"을 거르기 위한 함수 — 남의 읽음 행은 RLS로 못 읽으므로 security definer로 이 질문에만 답한다.
-- 호출자가 그 채널의 멤버일 때만 동작하고, 돌려주는 건 "끄지 않은 사람 id"뿐이다.
create or replace function public.messenger_unmuted_recipients(p_channel_id uuid, p_user_ids uuid[])
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select u
  from unnest(p_user_ids) as u
  where public.is_messenger_channel_member(p_channel_id)
    and not exists (
      select 1 from public.messenger_channel_reads r
      where r.channel_id = p_channel_id and r.user_id = u and r.muted
    );
$$;

revoke all on function public.messenger_unmuted_recipients(uuid, uuid[]) from public;
grant execute on function public.messenger_unmuted_recipients(uuid, uuid[]) to authenticated;

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
    where m.created_at > now() - interval '30 days'
      and m.sender_id is not null
      and m.sender_id is distinct from me.uid
      and not coalesce(r.muted, false)
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

revoke all on function public.get_messenger_unread(int) from public;
grant execute on function public.get_messenger_unread(int) to authenticated;
