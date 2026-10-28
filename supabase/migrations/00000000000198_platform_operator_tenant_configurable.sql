-- migration 196은 "플랫폼 운영 주체 테넌트"를 slug = 'osungtech'로
-- 하드코딩했는데, 바로 다음 날 "오성테크가 아니라 새로 만든 elvonix
-- 테넌트가 플랫폼 운영자여야 한다"는 요청이 들어왔다 — 이름이 또 바뀔 수
-- 있다는 뜻이므로, 다음에 또 바뀌어도 새 마이그레이션 없이 데이터만
-- 바꾸면 되도록 "어느 테넌트가 플랫폼 운영 주체인지"를 컬럼으로 빼서
-- 설정 가능하게 바꾼다.
alter table public.tenants add column if not exists is_platform_operator boolean not null default false;

-- 플랫폼 운영 주체 테넌트는 항상 하나뿐이어야 한다(동시에 여러 테넌트의
-- 관리자가 전부 플랫폼 전체 권한을 자동으로 받으면 안 됨) — true인 행이
-- 2개 이상 생기는 걸 막는 부분 유니크 인덱스.
create unique index if not exists tenants_single_platform_operator
  on public.tenants (is_platform_operator)
  where is_platform_operator;

-- elvonix 테넌트를 플랫폼 운영 주체로 지정한다. slug는 로그인 화면의
-- 회사코드와 완전히 같은 값이다(로그인 액션의
-- get_email_for_username(p_slug, p_username)과 동일한 매칭 기준) —
-- 혹시 이 시점에 해당 슬러그의 테넌트가 없으면(오타 등) 조용히 아무것도
-- 안 바뀌고 넘어간다. 이후 맞는 슬러그로 이 UPDATE 한 줄만 다시 실행하면
-- 플랫폼 운영 주체를 옮길 수 있다.
update public.tenants set is_platform_operator = true where slug = 'elvonix';

create or replace function public.is_platform_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    exists (select 1 from public.platform_admins where user_id = auth.uid())
    or exists (
      select 1
      from public.profiles p
      join public.tenants t on t.id = p.tenant_id
      where p.id = auth.uid()
        and p.role = 'admin'
        and t.is_platform_operator = true
    );
$$;

revoke all on function public.is_platform_admin() from public;
grant execute on function public.is_platform_admin() to authenticated;

-- elvonix 테넌트의 admin 계정(아이디 'admin')을 platform_admins 테이블에도
-- 직접 등록해 이중으로 보장한다 — 위 자동승격 조건(테넌트+역할)이 혹시
-- 안 맞아도(예: 역할이 아직 정확히 'admin'이 아니거나 슬러그가 예상과
-- 다르거나) 이 계정만큼은 확실히 플랫폼 관리자가 되게 한다. 해당 계정이
-- 없으면 아무것도 등록되지 않고 조용히 넘어간다.
insert into public.platform_admins (user_id)
select p.id
from public.profiles p
join public.tenants t on t.id = p.tenant_id
where t.slug = 'elvonix' and p.username = 'admin'
on conflict (user_id) do nothing;
