-- 사이드바 "DB 사용량" 위젯에서 Supabase 무료플랜 500MB 한도 대비
-- 현재 데이터베이스 용량을 보여주기 위한 RPC 함수.
create or replace function public.get_database_size()
returns bigint
language sql
security definer
set search_path = public
as $$
  select pg_database_size(current_database());
$$;

grant execute on function public.get_database_size() to authenticated;
