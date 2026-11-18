-- 270: 브라우저에서 본 화면 오류(오류 화면이 뜬 순간 브라우저가 서버로 보고)도 server_error_logs 에 kind='client_error' 로 남긴다.
-- 서버까지 도달하지 못한 요청(옛 화면의 로그인 버튼, 네트워크 끊김 등)은 서버 오류 기록에 안 남아서 원인을 알 수 없었다.
alter table public.server_error_logs drop constraint if exists server_error_logs_kind_check;
alter table public.server_error_logs
  add constraint server_error_logs_kind_check check (kind in ('error', 'slow_page', 'slow_nav', 'client_error'));
