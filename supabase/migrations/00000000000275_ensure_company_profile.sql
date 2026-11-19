-- 회사정보 저장이 "저장되었습니다"라고 하면서 실제로는 아무것도 저장하지 않던 버그.
-- company_profile은 (회사, 데모 여부)마다 행이 하나씩이고(129 이전부터 unique), 행은 회사를 만들 때 "실제 계정용" 하나만 같이 만든다.
-- 그런데 데모/샌드박스 계정은 RLS 때문에 자기 쪽(is_demo = true) 행만 볼 수 있어서, 그 행이 없으면 UPDATE가 0건을 바꾸고도 에러 없이 끝난다.
-- 저장 직전에 "내 (회사, 데모 여부)의 행"을 보장하는 함수 — 행이 이미 있으면 아무것도 안 한다(멱등).
-- 관리자만 호출할 수 있고, 새 행은 항상 호출한 사람의 회사/데모 구분으로만 만든다(다른 회사 행은 건드릴 수 없다).
create or replace function public.ensure_company_profile()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception '관리자만 회사정보를 만들 수 있습니다.';
  end if;
  insert into public.company_profile (tenant_id, is_demo, name)
  values (public.current_tenant_id(), public.is_demo_actor(), '')
  on conflict (tenant_id, is_demo) do nothing;
end;
$$;

revoke all on function public.ensure_company_profile() from public;
grant execute on function public.ensure_company_profile() to authenticated;
