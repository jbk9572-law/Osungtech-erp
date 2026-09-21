-- 플랫폼 관리 화면에 "새 회사 추가" 말고는 아무 것도 없었다 — 기존 회사
-- 정보 수정, 비활성화, 관리자 비밀번호 재설정, 회사별 사용자 목록,
-- 요금제 상태를 전부 추가한다.

-- 1) 비활성화(로그인 차단) + 요금제 상태.
--    삭제(하드 delete)는 일부러 넣지 않았다 — 테넌트를 지우면 그 회사의
--    매출/매입/재고 등 실제 업무 데이터까지 전부 같이 사라지는데, 되돌릴
--    방법이 없어 위험이 너무 크다. 서비스 중단은 "비활성화"로 충분하고,
--    데이터를 완전히 지워야 하는 경우는 이 화면이 아니라 DB를 직접
--    다뤄야 하는 예외적인 상황으로 남겨둔다.
alter table public.tenants add column if not exists disabled_at timestamptz;
alter table public.tenants add column if not exists plan text not null default 'active';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tenants_plan_check'
  ) then
    alter table public.tenants
      add constraint tenants_plan_check check (plan in ('trial', 'active', 'suspended'));
  end if;
end $$;

-- 2) 로그인 시 소속 테넌트가 비활성화됐는지 확인하는 함수. 로그인 전
--    (비로그인) 상태에서 호출돼야 해서 get_email_for_username과 동일하게
--    service_role에게만 실행 권한을 준다 — anon에게 열면 아이디만으로
--    "이 회사가 비활성화됐는지"를 무제한 조회할 수 있게 된다.
create or replace function public.is_login_tenant_disabled(p_username text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(bool_or(t.disabled_at is not null), false)
  from public.profiles p
  join public.tenants t on t.id = p.tenant_id
  where p.username = p_username;
$$;

revoke all on function public.is_login_tenant_disabled(text) from public, anon, authenticated;
grant execute on function public.is_login_tenant_disabled(text) to service_role;
