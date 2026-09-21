-- migration 40이 처음 만들어졌을 때(멀티테넌트 이전)는 "아이디@osungtech.local"
-- 형식이 고정값이었다 — 그 시점엔 tenants.slug 개념 자체가 없어서 그렇게
-- 짤 수밖에 없었다. 지금은 회사마다 "아이디@{슬러그}.elvonix.local" 형식을
-- 쓰는데, migration 40의 시드 계정만 옛날 형식 그대로 남아있어서 새로 DB를
-- 처음부터 재생(replay)할 때마다 매번 "osungtech.local" 형식의 계정이
-- 다시 생긴다. 이제 tenants.slug가 있으니, 그 시드 계정을 실제 소속
-- 테넌트의 슬러그 기반 형식으로 맞춘다.
do $$
declare
  v_user_id uuid;
  v_slug text;
  v_new_email text;
begin
  select p.id, t.slug into v_user_id, v_slug
  from public.profiles p
  join public.tenants t on t.id = p.tenant_id
  where p.email = 'admin@osungtech.local';

  if v_user_id is not null then
    v_new_email := 'admin@' || v_slug || '.elvonix.local';

    update auth.users set email = v_new_email where id = v_user_id;
    update public.profiles set email = v_new_email where id = v_user_id;
  end if;
end $$;
