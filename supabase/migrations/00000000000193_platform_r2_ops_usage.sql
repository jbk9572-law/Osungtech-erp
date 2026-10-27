-- "R2 읽기/쓰기 호출횟수는 의미없을까?" — 쓰기(Class A: PutObject/
-- ListObjects 등)는 이 서버가 직접 호출하므로 정확히 셀 수 있지만,
-- 읽기(Class B: GetObject)는 Presigned URL로 브라우저가 R2에 직접
-- 접속해 받는 구조(src/lib/r2/client.ts의 getR2DownloadUrl)라 이
-- 서버를 거치지 않는다 — 그래서 읽기는 정확히 셀 방법이 없다(Cloudflare
-- Analytics API를 새로 붙여야 하는데, 이미 R2 자격증명 설정만으로도
-- 충분히 번거로웠던 전례가 있어 지금은 붙이지 않는다). 쓰기만 정확히
-- 집계하고, 읽기는 계속 무료 한도 참고용 숫자만 보여준다.
--
-- 테넌트별이 아니라 플랫폼 전체 공용 카운터다 — R2 요금 자체가
-- 테넌트별이 아니라 계정(버킷) 전체 단위로 청구되기 때문에
-- tenant_monthly_usage가 아니라 별도 테이블에 둔다.
create table if not exists public.platform_r2_ops_usage (
  year_month text primary key, -- 'YYYY-MM' (Asia/Seoul 기준)
  class_a_count bigint not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.platform_r2_ops_usage enable row level security;
-- 일반 사용자는 직접 읽을 필요가 없다(플랫폼 운영자 전용 통계) — select
-- 정책을 아예 두지 않고, 증가는 아래 SECURITY DEFINER 함수로만, 조회는
-- is_platform_admin() 체크가 있는 get_platform_r2_ops_usage()로만 한다.

-- 파일 업로드가 R2로 실제 PutObjectCommand를 보낸 직후
-- (src/lib/storage/upload-attachment.ts) 호출한다. 어느 테넌트의
-- 업로드든 같은 공용 카운터를 올리므로 current_tenant_id() 체크 없이
-- 로그인한 사용자면 누구나 호출 가능 — 늘어나는 값이 "청구서에 찍힐
-- 실제 횟수"와 같아야 더 의미 있어서 is_demo_actor() 여부와 무관하게
-- 항상 센다(데모 계정도 실제로 R2에 PutObject를 한 번 보낸 건 맞다).
create or replace function public.increment_platform_r2_class_a_ops(p_count integer default 1)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year_month text := to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM');
  v_new_count bigint;
begin
  insert into public.platform_r2_ops_usage (year_month, class_a_count)
  values (v_year_month, greatest(0, p_count))
  on conflict (year_month) do update
    set class_a_count = public.platform_r2_ops_usage.class_a_count + greatest(0, p_count),
        updated_at = now()
  returning class_a_count into v_new_count;

  return v_new_count;
end;
$$;

revoke all on function public.increment_platform_r2_class_a_ops(integer) from public;
grant execute on function public.increment_platform_r2_class_a_ops(integer) to authenticated;

create or replace function public.get_platform_r2_ops_usage()
returns bigint
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_year_month text := to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM');
begin
  if not public.is_platform_admin() then
    raise exception '플랫폼 운영자만 조회할 수 있습니다.';
  end if;

  return coalesce(
    (select class_a_count from public.platform_r2_ops_usage where year_month = v_year_month),
    0
  );
end;
$$;

revoke all on function public.get_platform_r2_ops_usage() from public;
grant execute on function public.get_platform_r2_ops_usage() to authenticated;
