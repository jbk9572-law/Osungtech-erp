-- 버그: 새 테넌트를 만들 때(handle_new_user, 121) company_profile 행을
-- 같이 만들어주지 않아서, 새 회사는 회사정보가 비어있는 상태로 시작했다.
-- 화면 곳곳(상태바/타이틀바/매출 엑셀 출력 등)이 회사명이 비어있으면
-- "오성테크"로 폴백하도록 짜여있어서(1테넌트 시절 흔적), 새 회사 화면에
-- 엉뚱하게 "오성테크"가 찍혀 마치 데이터가 안 나뉜 것처럼 보였다 —
-- 실제 매출/매입 등 업무 데이터는 tenant_id로 정상 격리되고 있었다.
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
