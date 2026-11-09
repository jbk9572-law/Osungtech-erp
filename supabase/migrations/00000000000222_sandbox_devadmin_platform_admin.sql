-- 사용자 요청 — 샌드박스 테넌트의 devadmin 계정을 플랫폼 통합관리자
-- (platform_admins)로 지정한다. migration 198의 "elvonix 테넌트
-- admin 계정을 platform_admins에 직접 등록" 패턴과 동일하게, 자동승격
-- 조건(테넌트가 is_platform_operator인 경우)과 무관하게 이 계정만큼은
-- 확실히 플랫폼 관리자가 되도록 명시적으로 등록한다. 샌드박스 테넌트가
-- 여러 개거나 devadmin 계정이 없으면 그만큼만 조용히 등록되거나
-- 아무것도 등록되지 않고 넘어간다(안전한 기본 동작).
insert into public.platform_admins (user_id)
select p.id
from public.profiles p
join public.tenants t on t.id = p.tenant_id
where t.is_sandbox = true and p.username = 'devadmin'
on conflict (user_id) do nothing;
