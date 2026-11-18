-- 268: 느린 화면·느린 이동도 서버 오류 기록(server_error_logs)에 같이 남긴다 — 한 곳(플랫폼 관리자 > 서버 오류·느린 화면)에서 본다.
-- kind: error(서버 화면 오류) / slow_page(서버에서 화면 만드는 시간이 기준 초과) / slow_nav(사용자가 클릭 후 내용이 보이기까지 기준 초과)
alter table public.server_error_logs add column if not exists kind text not null default 'error';
alter table public.server_error_logs add column if not exists duration_ms integer;
alter table public.server_error_logs add column if not exists db_calls integer;
alter table public.server_error_logs add column if not exists db_ms integer;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'server_error_logs_kind_check') then
    alter table public.server_error_logs
      add constraint server_error_logs_kind_check check (kind in ('error', 'slow_page', 'slow_nav'));
  end if;
end;
$$;
create index if not exists server_error_logs_kind_created_idx on public.server_error_logs (kind, created_at desc);
