-- 버그: 새 테넌트를 만들 때(handle_new_user, 121) company_profile 행을
-- 같이 만들어주지 않아서, 새 회사는 회사정보가 비어있는 상태로 시작했다.
-- 화면 곳곳(상태바/타이틀바/매출 엑셀 출력 등)이 회사명이 비어있으면
-- "오성테크"로 폴백하도록 짜여있어서(1테넌트 시절 흔적), 새 회사 화면에
-- 엉뚱하게 "오성테크"가 찍혀 마치 데이터가 안 나뉜 것처럼 보였다 —
-- 실제 매출/매입 등 업무 데이터는 tenant_id로 정상 격리되고 있었다.

-- 0) 선행 버그: company_profile.id가 원래 "싱글턴 행 1개"로 설계돼
--    (migration 3) 기본값이 항상 고정된 1이다. 여러 회사가 각자 행을
--    가지게 된 뒤(migration 86)에도 이 기본값을 안 고쳐서, id를 안 정해주고
--    두 번째 이상 행을 넣으면 전부 "id=1 중복"으로 실패한다 — 지금
--    고치지 않으면 아래 handle_new_user()가 새 회사를 만들 때마다 매번
--    이 에러로 실패한다. 제대로 된 시퀀스를 만들어 연결한다.
create sequence if not exists public.company_profile_id_seq owned by public.company_profile.id;
select setval(
  'public.company_profile_id_seq',
  greatest((select coalesce(max(id), 0) from public.company_profile), 1),
  true
);
alter table public.company_profile alter column id set default nextval('public.company_profile_id_seq');

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_new_tenant_name text;
  v_new_tenant_slug text;
  v_is_new_tenant boolean := false;
begin
  v_tenant_id := nullif(new.raw_user_meta_data ->> 'tenant_id', '')::uuid;
  v_new_tenant_name := nullif(new.raw_user_meta_data ->> 'new_tenant_name', '');
  v_new_tenant_slug := nullif(new.raw_user_meta_data ->> 'new_tenant_slug', '');

  if v_tenant_id is null and v_new_tenant_name is not null then
    insert into public.tenants (name, slug)
    values (v_new_tenant_name, v_new_tenant_slug)
    returning id into v_tenant_id;
    v_is_new_tenant := true;
  end if;

  if v_tenant_id is null then
    raise exception
      '계정 생성 시 user_metadata에 tenant_id(기존 테넌트 합류) 또는 new_tenant_name+new_tenant_slug(신규 테넌트 생성)가 반드시 필요합니다.';
  end if;

  insert into public.tenant_members (tenant_id, user_id)
  values (v_tenant_id, new.id)
  on conflict (user_id) do nothing;

  insert into public.profiles (id, full_name, email, username, tenant_id)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.email,
    new.raw_user_meta_data ->> 'username',
    v_tenant_id
  );

  -- 새 테넌트를 만든 경우에만 company_profile 초기 행도 같이 만든다
  -- (기존 테넌트에 합류하는 경우는 이미 그 회사의 행이 있다).
  if v_is_new_tenant then
    insert into public.company_profile (tenant_id, name)
    values (v_tenant_id, v_new_tenant_name);
  end if;

  return new;
end;
$$;

-- 이미 회사정보 없이 만들어진 기존 테넌트가 있으면(예: 이번에 발견된
-- 테스트 계정들) 여기서도 채워준다 — 새로 만드는 테넌트만 고치면
-- 이미 생성된 것들은 계속 비어있는 채로 남는다.
insert into public.company_profile (tenant_id, name)
select t.id, t.name
from public.tenants t
where not exists (
  select 1 from public.company_profile cp where cp.tenant_id = t.id and cp.is_demo = false
);
