-- 플랫폼 운영자 전용 인프라 사용량 위젯에 R2 파일 저장소 사용량을
-- 추가한다. R2는 S3 호환 API만 붙여놨고(src/lib/r2/client.ts) 계정
-- 전체 사용량을 알려주는 집계 API는 따로 연동하지 않았다 — 대신 이미
-- 테넌트마다 정확히 추적 중인 tenant_usage.file_bytes_used(파일 업로드/
-- 삭제 때마다 애플리케이션이 직접 갱신 — migration 186/187)를 전부
-- 더하면 "지금까지 R2에 올라간 총 바이트"와 사실상 같다(R2 전환 이전
-- Supabase Storage에 남아있는 구 파일 일부는 포함 안 되지만, 새 업로드는
-- 전부 R2로 가므로 시간이 지날수록 더 정확해진다).
create or replace function public.get_platform_r2_usage()
returns bigint
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_platform_admin() then
    raise exception '플랫폼 운영자만 조회할 수 있습니다.';
  end if;

  return coalesce((select sum(file_bytes_used) from public.tenant_usage), 0)::bigint;
end;
$$;

revoke all on function public.get_platform_r2_usage() from public;
grant execute on function public.get_platform_r2_usage() to authenticated;
