-- 186에서 DB 쿼터(bump_tenant_db_usage)는 데모 계정 데이터를 집계에서
-- 뺐는데, 파일 쿼터(increment_tenant_file_usage)는 그 당시 R2 자격증명이
-- 없어 실제 업로드를 돌려볼 수 없었던 탓에 빠뜨렸다 — 메신저 첨부파일을
-- 데모 계정으로 올려도 그대로 실제 회사의 300MB 파일 쿼터를 깎아먹던
-- 문제. is_demo_actor()(migration 85)로 호출한 계정이 데모인지 확인해
-- DB 쿼터와 같은 기준으로 맞춘다.
create or replace function public.increment_tenant_file_usage(p_delta_bytes bigint)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid := public.current_tenant_id();
  v_new_bytes bigint;
begin
  if v_tenant_id is null then
    raise exception '소속 테넌트를 확인할 수 없습니다.';
  end if;

  if public.is_demo_actor() then
    select coalesce(file_bytes_used, 0) into v_new_bytes
    from public.tenant_usage where tenant_id = v_tenant_id;
    return coalesce(v_new_bytes, 0);
  end if;

  insert into public.tenant_usage (tenant_id, file_bytes_used, updated_at)
  values (v_tenant_id, greatest(0, p_delta_bytes), now())
  on conflict (tenant_id) do update
    set file_bytes_used = greatest(0, public.tenant_usage.file_bytes_used + p_delta_bytes),
        updated_at = now()
  returning file_bytes_used into v_new_bytes;

  return v_new_bytes;
end;
$$;
