-- 점검 모드를 서버 입구(proxy)에서 막기 위한 가벼운 조회 함수.
--
-- 지금까지 점검 모드는 (dashboard)/layout.tsx에서만 확인했는데, Next.js 레이아웃은 이미 열려 있는 화면 안에서 메뉴를 옮길 때
-- 다시 그려지지 않아 접속 중인 사용자는 새로고침 전까지 계속 일할 수 있었고, 저장 요청(서버 액션)과 거래처 포털은 아예 막히지 않았다.
-- 이제 모든 요청이 지나가는 proxy에서 확인한다. proxy는 로그인 전(포털 등)에도 이 값을 알아야 하므로
-- anon도 호출할 수 있어야 한다 — 노출되는 정보는 "점검 중인지"와 안내 문구뿐이라 공개해도 안전하다.
create or replace function public.get_maintenance_flag()
returns table (maintenance_mode boolean, maintenance_message text)
language sql
security definer
set search_path = public
stable
as $$
  select ps.maintenance_mode, ps.maintenance_message from public.platform_settings ps limit 1
$$;

revoke all on function public.get_maintenance_flag() from public;
grant execute on function public.get_maintenance_flag() to anon, authenticated;
