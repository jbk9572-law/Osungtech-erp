-- 264: 서버 화면 렌더 오류 기록. Next.js 는 운영 빌드에서 서버 오류 문구를 화면·로그에서 지우고 digest 만 남긴다
-- ("일시적인 오류로 화면을 불러오지 못했습니다"). onRequestError 훅에서 진짜 문구를 여기에 남겨
-- 플랫폼 관리자 > 서버 오류 에서 digest 로 찾아 볼 수 있게 한다. 기록은 서버(service role)만 하고, 조회·정리는 플랫폼 관리자만 한다.
create table if not exists public.server_error_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  digest text,
  path text,
  route_path text,
  route_type text,
  error_name text,
  message text,
  stack text
);
create index if not exists server_error_logs_created_idx on public.server_error_logs (created_at desc);
create index if not exists server_error_logs_digest_idx on public.server_error_logs (digest);

alter table public.server_error_logs enable row level security;

create policy "server_error_logs_select_platform_admin" on public.server_error_logs
  for select to authenticated using (public.is_platform_admin());
create policy "server_error_logs_delete_platform_admin" on public.server_error_logs
  for delete to authenticated using (public.is_platform_admin());
