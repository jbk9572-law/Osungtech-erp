-- 사이드바 "사용량" 위젯에서 Supabase 무료플랜 1GB 파일저장 한도 대비
-- 현재 스토리지(storage.objects) 사용량을 보여주기 위한 RPC 함수.
create or replace function public.get_storage_size()
returns bigint
language sql
security definer
set search_path = public
as $$
  select coalesce(sum((metadata->>'size')::bigint), 0)
  from storage.objects;
$$;

grant execute on function public.get_storage_size() to authenticated;
