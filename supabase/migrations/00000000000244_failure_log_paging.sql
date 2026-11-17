-- 실패 로그 확장(모든 DB 변경 실패를 자동 기록) 후속: 조회를 페이지로 넘겨 볼 수 있게 하고, 오래된 기록을 정리한다.
--
--  1) get_cross_tenant_failure_log에 p_offset(몇 건 건너뛸지)과 total_count(전체 건수)를 추가한다.
--     한 번에 가져오는 건수는 1000건으로 제한한다(화면은 200건씩 보여 주고 이전/다음으로 넘긴다).
--  2) 실패가 전부 쌓이면 무료 DB 용량을 잡아먹을 수 있으므로, 90일이 지난 기록은 purge_old_failure_logs()로 지운다
--     (플랫폼 운영자가 실패 로그 화면을 열 때마다 호출 — 별도 스케줄러 없이 동작).
--  3) 최근 순 조회가 빠르도록 created_at 인덱스를 추가한다.
create index if not exists failure_logs_created_idx on public.failure_logs (created_at desc);

drop function if exists public.get_cross_tenant_failure_log(integer);

create or replace function public.get_cross_tenant_failure_log(p_limit integer default 200, p_offset integer default 0)
returns table (
  id uuid,
  tenant_name text,
  code text,
  message_ko text,
  action text,
  entity_type text,
  detail text,
  actor_name text,
  created_at timestamptz,
  total_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception '플랫폼 운영자만 조회할 수 있습니다.';
  end if;

  return query
    select fl.id, t.name as tenant_name, fl.code, fl.message_ko, fl.action, fl.entity_type,
           fl.detail, p.full_name as actor_name, fl.created_at,
           count(*) over () as total_count
    from public.failure_logs fl
    left join public.tenants t on t.id = fl.tenant_id
    left join public.profiles p on p.id = fl.actor
    where fl.is_demo = false
    order by fl.created_at desc
    limit least(greatest(coalesce(p_limit, 200), 1), 1000)
    offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

revoke all on function public.get_cross_tenant_failure_log(integer, integer) from public;
grant execute on function public.get_cross_tenant_failure_log(integer, integer) to authenticated;

create or replace function public.purge_old_failure_logs()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  if not public.is_platform_admin() then
    raise exception '플랫폼 운영자만 실행할 수 있습니다.';
  end if;

  delete from public.failure_logs where created_at < now() - interval '90 days';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.purge_old_failure_logs() from public;
grant execute on function public.purge_old_failure_logs() to authenticated;
