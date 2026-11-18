#!/usr/bin/env bash
# 전체 스키마 자동 스캔(읽기 전용): 사람이 놓치기 쉬운 "구조적" 구멍 후보를 찾는다. setup.sh 후 실행.
P="psql -h /tmp/pgfull -p 5545 -U postgres -d fulldb -X -q -At -F |"
echo "== A) RLS 꺼진 public 테이블"
$P -c "select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity order by 1"
echo "== B) tenant_id 컬럼이 있는데 tenant 격리(restrictive) 정책이 없는 테이블"
$P -c "select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid and a.attname='tenant_id' and not a.attisdropped where n.nspname='public' and c.relkind='r' and not exists (select 1 from pg_policy p where p.polrelid=c.oid and not p.polpermissive) order by 1"
echo "== C) 직원(authenticated)이 호출 가능한 definer 함수 중 본문에 인증/회사/권한 확인이 전혀 없는 것"
$P -c "select p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef and has_function_privilege('authenticated',p.oid,'execute') and p.prosrc !~* '(auth\.uid|current_tenant_id|is_admin|is_platform_admin|assert_|current_setting|auth\.role|service_role|session_user|current_user)' order by 1"
echo "== D) using(true)/with check(true) 정책이 있는 테이블 (permissive)"
$P -c "select c.relname||' · '||p.polname||' · '||case p.polcmd when 'r' then 'select' when 'a' then 'insert' when 'w' then 'update' when 'd' then 'delete' else 'all' end from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and p.polpermissive and p.polcmd<>'r' and (coalesce(pg_get_expr(p.polqual,p.polrelid),'true') in ('true') or coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'x') = 'true') order by 1"
echo "== E) 직원 누구나 쓰기(insert/update/delete) 가능하고 작성자/관리자 조건이 없는 정책"
$P -c "select c.relname||' · '||p.polname||' · '||case p.polcmd when 'a' then 'insert' when 'w' then 'update' when 'd' then 'delete' else 'all' end from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and p.polpermissive and p.polcmd in ('a','w','d','*') and (coalesce(pg_get_expr(p.polqual,p.polrelid),'')||coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')) !~* '(auth\.uid|is_admin|is_platform_admin|created_by|user_id|current_tenant_id)' order by 1"
