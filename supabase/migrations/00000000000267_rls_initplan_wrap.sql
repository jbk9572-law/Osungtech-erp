-- 267: RLS 성능. 정책식 안의 current_tenant_id() / is_demo_actor() / is_admin() / is_platform_admin() / auth.uid() / auth.role() 는
-- 그대로 두면 "행마다" 다시 실행된다(함수가 매번 하위 조회를 함). 측정: 샌드박스 더미 데이터(매출 692건·라인 1268건)에서 메인 화면식 조회 590ms 중
-- 380ms 가 categories 행마다 반복 호출된 함수였고, 데이터가 늘수록 비례해서 느려져 메인 대시보드가 "로딩만" 하는 원인 후보다.
-- (select 함수()) 로 감싸면 쿼리당 한 번만 계산된다(Postgres initplan). 의미는 같다 — 행과 무관한 값이라서.
-- 모든 public 정책을 한 번에 같은 규칙으로 바꾸고, 이미 감싼 것은 건드리지 않는다(다시 실행해도 안전).
do $$
declare
  pol record;
  fn text;
  fns text[] := array['current_tenant_id', 'is_demo_actor', 'is_admin', 'is_platform_admin'];
  q text;
  w text;
  q2 text;
  w2 text;
  stmt text;
  changed int := 0;
begin
  for pol in
    select p.polname, c.oid as relid, format('%I.%I', n.nspname, c.relname) as rel,
           pg_get_expr(p.polqual, p.polrelid) as qual, pg_get_expr(p.polwithcheck, p.polrelid) as chk
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
  loop
    q := pol.qual; w := pol.chk; q2 := q; w2 := w;
    foreach fn in array fns loop
      -- 이미 감싼 형태( SELECT fn() AS fn )는 토큰으로 가렸다가 되돌린다.
      if q2 is not null then
        q2 := regexp_replace(q2, '\(\s*SELECT\s+(public\.)?' || fn || '\(\)\s+AS\s+' || fn || '\s*\)', '@@' || fn || '@@', 'gi');
        q2 := regexp_replace(q2, '\m(public\.)?' || fn || '\(\)', '(select ' || fn || '())', 'g');
        q2 := replace(q2, '@@' || fn || '@@', '(select ' || fn || '())');
      end if;
      if w2 is not null then
        w2 := regexp_replace(w2, '\(\s*SELECT\s+(public\.)?' || fn || '\(\)\s+AS\s+' || fn || '\s*\)', '@@' || fn || '@@', 'gi');
        w2 := regexp_replace(w2, '\m(public\.)?' || fn || '\(\)', '(select ' || fn || '())', 'g');
        w2 := replace(w2, '@@' || fn || '@@', '(select ' || fn || '())');
      end if;
    end loop;
    -- auth.uid() / auth.role()
    foreach fn in array array['uid', 'role'] loop
      if q2 is not null then
        q2 := regexp_replace(q2, '\(\s*SELECT\s+auth\.' || fn || '\(\)\s+AS\s+' || fn || '\s*\)', '@@auth' || fn || '@@', 'gi');
        q2 := regexp_replace(q2, '\mauth\.' || fn || '\(\)', '(select auth.' || fn || '())', 'g');
        q2 := replace(q2, '@@auth' || fn || '@@', '(select auth.' || fn || '())');
      end if;
      if w2 is not null then
        w2 := regexp_replace(w2, '\(\s*SELECT\s+auth\.' || fn || '\(\)\s+AS\s+' || fn || '\s*\)', '@@auth' || fn || '@@', 'gi');
        w2 := regexp_replace(w2, '\mauth\.' || fn || '\(\)', '(select auth.' || fn || '())', 'g');
        w2 := replace(w2, '@@auth' || fn || '@@', '(select auth.' || fn || '())');
      end if;
    end loop;

    if q2 is not distinct from q and w2 is not distinct from w then
      continue;
    end if;
    stmt := format('alter policy %I on %s', pol.polname, pol.rel);
    if q2 is not null then stmt := stmt || ' using (' || q2 || ')'; end if;
    if w2 is not null then stmt := stmt || ' with check (' || w2 || ')'; end if;
    execute stmt;
    changed := changed + 1;
  end loop;
  raise notice 'RLS 정책 % 개를 initplan 형태로 바꿨습니다.', changed;
end;
$$;
