-- 사내메신저를 "회사 전체 단일 채널"에서 "전체/1:1 DM/그룹" 3종류로
-- 확장한다. 지금까지는 누가 보낸 메시지든 같은 테넌트(+demo) 안이면
-- 전부 다 보였는데, 귓속말/소그룹 대화가 불가능하다는 게 실사용상 가장
-- 크게 느껴지는 공백이었다(사내메신저 사용팁 벤치마킹 결과).
--
-- 기존 messenger_messages는 그대로 두고 channel_id만 추가한다 — 지금까지
-- 쌓인 메시지는 전부 "전체" 채널 소속으로 백필한다. 테넌트(+demo)마다
-- "전체" 채널이 정확히 하나씩 있어야 하므로, 이미 있는 테넌트들에 대해
-- 미리 만들어두고, 앞으로 새 테넌트가 생기면 get_or_create_all_channel()
-- RPC가 최초 접속 시 자동으로 만든다(테넌트 생성 코드를 따로 안 건드려도
-- 됨).

create table public.messenger_channels (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  is_demo boolean not null default public.is_demo_actor(),
  type text not null check (type in ('all', 'dm', 'group')),
  -- 전체/DM 채널은 이름이 없다(참여자 이름으로 표시). 그룹만 이름을 쓴다.
  name text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- 테넌트(+demo)당 "전체" 채널은 정확히 하나여야 한다.
create unique index messenger_channels_one_all_per_tenant_demo
  on public.messenger_channels (tenant_id, is_demo)
  where type = 'all';

create index messenger_channels_tenant_id_idx on public.messenger_channels (tenant_id);

create table public.messenger_channel_members (
  channel_id uuid not null references public.messenger_channels (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  tenant_id uuid not null default public.current_tenant_id() references public.tenants (id) on delete cascade,
  is_demo boolean not null default public.is_demo_actor(),
  joined_at timestamptz not null default now(),
  primary key (channel_id, user_id)
);

create index messenger_channel_members_user_id_idx on public.messenger_channel_members (user_id);
create index messenger_channel_members_tenant_id_idx on public.messenger_channel_members (tenant_id);

alter table public.messenger_channels enable row level security;
alter table public.messenger_channel_members enable row level security;

-- 다른 업무 테이블과 동일한 이중 RESTRICTIVE 패턴(tenant_id/is_demo).
create policy "messenger_channels_tenant_isolation" on public.messenger_channels
  as restrictive for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());
create policy "messenger_channels_demo_isolation" on public.messenger_channels
  as restrictive for all
  using (is_demo = public.is_demo_actor())
  with check (is_demo = public.is_demo_actor());

create policy "messenger_channel_members_tenant_isolation" on public.messenger_channel_members
  as restrictive for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());
create policy "messenger_channel_members_demo_isolation" on public.messenger_channel_members
  as restrictive for all
  using (is_demo = public.is_demo_actor())
  with check (is_demo = public.is_demo_actor());

-- 채널 멤버인지 확인하는 함수. messenger_channel_members를 messenger_
-- messages/messenger_channels RLS 안에서 직접 서브쿼리하면 그 테이블
-- 자신의 RLS를 다시 평가하다 재귀에 걸릴 수 있어(같은 함수를 자기 자신의
-- select 정책에도 쓰기 때문), security definer로 우회해서 순수 boolean만
-- 돌려준다. "전체" 채널은 멤버 행이 따로 없고 테넌트 소속이면 누구나
-- 볼 수 있다.
create or replace function public.is_messenger_channel_member(p_channel_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.messenger_channels c
    where c.id = p_channel_id
      and c.tenant_id = public.current_tenant_id()
      and c.is_demo = public.is_demo_actor()
      and (
        c.type = 'all'
        or exists (
          select 1 from public.messenger_channel_members m
          where m.channel_id = p_channel_id and m.user_id = auth.uid()
        )
      )
  );
$$;

revoke all on function public.is_messenger_channel_member(uuid) from public;
grant execute on function public.is_messenger_channel_member(uuid) to authenticated;

create policy "messenger_channels_select_authenticated" on public.messenger_channels
  for select using (auth.role() = 'authenticated');
-- 채널 자체를 클라이언트가 직접 만들지 않는다 — get_or_create_all_channel/
-- create_dm_channel/create_group_channel 세 RPC로만 생성한다(모두 security
-- definer). 그래서 insert/update/delete permissive 정책은 열지 않는다.

-- 멤버 목록도 같은 이유로 select만 연다 — 본인이 속한 채널의 멤버만.
create policy "messenger_channel_members_select_own_channels" on public.messenger_channel_members
  for select using (auth.role() = 'authenticated' and public.is_messenger_channel_member(channel_id));

-- 채널 목록 조회 자체는 "전체"만 permissive select로 다 보이고, DM/그룹은
-- 멤버가 아니면 안 보여야 한다 — 위의 select_authenticated(permissive)에
-- 아래 RESTRICTIVE를 하나 더 얹어 AND로 좁힌다.
create policy "messenger_channels_membership" on public.messenger_channels
  as restrictive for select
  using (type = 'all' or public.is_messenger_channel_member(id));

-- "전체" 채널 자동 생성/조회. 테넌트+demo 조합마다 최초 1회만 만든다.
create or replace function public.get_or_create_all_channel()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_channel_id uuid;
  v_tenant_id uuid := public.current_tenant_id();
  v_is_demo boolean := public.is_demo_actor();
begin
  select id into v_channel_id from public.messenger_channels
  where tenant_id = v_tenant_id and is_demo = v_is_demo and type = 'all';

  if v_channel_id is null then
    insert into public.messenger_channels (tenant_id, is_demo, type, name)
    values (v_tenant_id, v_is_demo, 'all', null)
    on conflict (tenant_id, is_demo) where type = 'all' do nothing
    returning id into v_channel_id;

    if v_channel_id is null then
      select id into v_channel_id from public.messenger_channels
      where tenant_id = v_tenant_id and is_demo = v_is_demo and type = 'all';
    end if;
  end if;

  return v_channel_id;
end;
$$;

revoke all on function public.get_or_create_all_channel() from public;
grant execute on function public.get_or_create_all_channel() to authenticated;

-- 1:1 DM. 같은 두 사람 사이에 이미 만들어진 DM 채널이 있으면 그걸 그대로
-- 재사용한다(중복 방지).
create or replace function public.create_dm_channel(p_other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_channel_id uuid;
  v_tenant_id uuid := public.current_tenant_id();
  v_is_demo boolean := public.is_demo_actor();
  v_self uuid := auth.uid();
begin
  if p_other_user_id = v_self then
    raise exception '자기 자신과는 DM을 만들 수 없습니다.';
  end if;

  select c.id into v_channel_id
  from public.messenger_channels c
  where c.tenant_id = v_tenant_id and c.is_demo = v_is_demo and c.type = 'dm'
    and exists (select 1 from public.messenger_channel_members m where m.channel_id = c.id and m.user_id = v_self)
    and exists (select 1 from public.messenger_channel_members m where m.channel_id = c.id and m.user_id = p_other_user_id)
    and (select count(*) from public.messenger_channel_members m where m.channel_id = c.id) = 2
  limit 1;

  if v_channel_id is not null then
    return v_channel_id;
  end if;

  insert into public.messenger_channels (tenant_id, is_demo, type, name, created_by)
  values (v_tenant_id, v_is_demo, 'dm', null, v_self)
  returning id into v_channel_id;

  insert into public.messenger_channel_members (channel_id, user_id, tenant_id, is_demo)
  values
    (v_channel_id, v_self, v_tenant_id, v_is_demo),
    (v_channel_id, p_other_user_id, v_tenant_id, v_is_demo);

  return v_channel_id;
end;
$$;

revoke all on function public.create_dm_channel(uuid) from public;
grant execute on function public.create_dm_channel(uuid) to authenticated;

-- 그룹방. 만든 사람이 자동으로 첫 멤버가 된다.
create or replace function public.create_group_channel(p_name text, p_member_ids uuid[])
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_channel_id uuid;
  v_tenant_id uuid := public.current_tenant_id();
  v_is_demo boolean := public.is_demo_actor();
  v_self uuid := auth.uid();
  v_member_id uuid;
begin
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception '그룹 이름을 입력해주세요.';
  end if;

  insert into public.messenger_channels (tenant_id, is_demo, type, name, created_by)
  values (v_tenant_id, v_is_demo, 'group', trim(p_name), v_self)
  returning id into v_channel_id;

  insert into public.messenger_channel_members (channel_id, user_id, tenant_id, is_demo)
  values (v_channel_id, v_self, v_tenant_id, v_is_demo);

  foreach v_member_id in array p_member_ids loop
    if v_member_id <> v_self then
      insert into public.messenger_channel_members (channel_id, user_id, tenant_id, is_demo)
      values (v_channel_id, v_member_id, v_tenant_id, v_is_demo)
      on conflict do nothing;
    end if;
  end loop;

  return v_channel_id;
end;
$$;

revoke all on function public.create_group_channel(text, uuid[]) from public;
grant execute on function public.create_group_channel(text, uuid[]) to authenticated;

-- 그룹방 나가기("전체"/DM은 나갈 수 없다 — DM은 상대가 있어 의미 없고,
-- 전체는 애초에 멤버 행 자체가 없다).
create or replace function public.leave_messenger_channel(p_channel_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.messenger_channel_members
  where channel_id = p_channel_id
    and user_id = auth.uid()
    and exists (select 1 from public.messenger_channels where id = p_channel_id and type = 'group');
end;
$$;

revoke all on function public.leave_messenger_channel(uuid) from public;
grant execute on function public.leave_messenger_channel(uuid) to authenticated;

-- 기존 테넌트(+demo)마다 "전체" 채널을 미리 만들어 백필 대상을 확보한다.
insert into public.messenger_channels (tenant_id, is_demo, type, name)
select t.id, d.is_demo, 'all', null
from public.tenants t
cross join (values (true), (false)) as d(is_demo)
on conflict (tenant_id, is_demo) where type = 'all' do nothing;

alter table public.messenger_messages add column if not exists channel_id uuid references public.messenger_channels (id) on delete cascade;

update public.messenger_messages m
set channel_id = c.id
from public.messenger_channels c
where c.tenant_id = m.tenant_id and c.is_demo = m.is_demo and c.type = 'all'
  and m.channel_id is null;

alter table public.messenger_messages alter column channel_id set not null;
create index messenger_messages_channel_id_idx on public.messenger_messages (channel_id, created_at);

-- 기존 select/insert 정책(전체 테넌트원 다 보임)은 그대로 두고, 채널
-- 멤버십 조건만 RESTRICTIVE로 하나 더 얹는다 — "전체" 채널 메시지는
-- 지금까지처럼 테넌트 전원에게 보이고, DM/그룹 메시지만 새로 좁혀진다.
create policy "messenger_messages_channel_membership" on public.messenger_messages
  as restrictive for all
  using (public.is_messenger_channel_member(channel_id))
  with check (public.is_messenger_channel_member(channel_id));
