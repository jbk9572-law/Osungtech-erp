-- 236의 get_messenger_unread 보강 — (1) 최근 30일 메시지만 센다: 메신저 메시지는 행마다 RLS(채널 멤버 확인)가 평가되므로
-- 기간을 제한하지 않으면 오래 쓸수록 메인 화면을 열 때마다 훑는 양이 계속 늘어난다. 30일 넘게 안 읽은 대화는 메인
-- 알림에서는 빠지고 메신저 화면에는 그대로 있다. (2) 로그인 안 한 사용자(anon)가 호출할 수 없게 public 실행 권한을 뺀다.
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
      and m.sender_id is distinct from me.uid
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
