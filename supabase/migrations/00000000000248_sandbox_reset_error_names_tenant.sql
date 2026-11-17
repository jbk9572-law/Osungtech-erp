-- 샌드박스 초기화가 거절될 때 "어느 회사로 인식했는지"를 오류 문구에 포함한다.
-- 운영자가 회사 전환으로 샌드박스에 들어갔는데도 "샌드박스로 지정되지 않았다"고 나오는 경우, 전환이 안 된 것인지(홈 회사 이름이 나옴)
-- 그 회사의 샌드박스 지정이 꺼져 있는 것인지(샌드박스 회사 이름이 나옴)를 문구만 보고 가릴 수 있다. 함수 본문은 212와 같고 이 문구만 바뀐다.
create or replace function public.sandbox_reset()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid := public.current_tenant_id();
  v_tbl record;
  v_pass int;
  v_remaining int := 0;
  v_prev_remaining int := -1;
  v_exclude text[] := array['profiles', 'tenant_members'];
begin
  if not public.is_admin() then
    raise exception '관리자만 실행할 수 있습니다.';
  end if;
  if not public.is_sandbox_tenant() then
    -- 어느 회사로 인식했는지 같이 알려, "전환이 안 된 것"인지 "그 회사가 샌드박스로 지정 안 된 것"인지 바로 구분되게 한다.
    raise exception '지금 들어와 있는 회사(%)는 샌드박스로 지정되어 있지 않습니다. 플랫폼관리자 > 고객사 상세에서 이 회사를 「샌드박스로 지정」했는지, 올바른 회사로 전환했는지 확인해 주세요.',
      coalesce((select name from public.tenants where id = v_tenant_id), '알 수 없음');
  end if;

  for v_pass in 1..5 loop
    v_remaining := 0;
    for v_tbl in
      select c.table_name from information_schema.columns c
      where c.table_schema = 'public' and c.column_name = 'tenant_id'
        and c.table_name <> all(v_exclude)
    loop
      begin
        execute format('delete from public.%I where tenant_id = $1', v_tbl.table_name) using v_tenant_id;
      exception when foreign_key_violation then
        v_remaining := v_remaining + 1;
      end;
    end loop;
    exit when v_remaining = 0 or v_remaining = v_prev_remaining;
    v_prev_remaining := v_remaining;
  end loop;

  if v_remaining > 0 then
    raise exception '일부 테이블(%개)을 정리하지 못했습니다 — 참조 구조를 다시 확인해주세요.', v_remaining;
  end if;
end;
$$;
