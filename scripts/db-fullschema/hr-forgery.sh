#!/usr/bin/env bash
# 직원 직접 REST 위조 방어 검증 (migration 260). setup.sh + approval-race.sh 픽스처 필요.
set -u
P="psql -h /tmp/pgfull -p 5545 -U postgres -d fulldb -X -q -At"
TA=aaaaaaaa-0000-0000-0000-00000000000a; A2=a0000000-0000-0000-0000-000000000002; B1=b0000000-0000-0000-0000-000000000001
PRIV=$($P -c "select has_function_privilege('authenticated','public.consume_subcontractor_material_for_step(uuid)','execute')")
$P -c "grant usage on schema public to authenticated; grant select,insert,update,delete on all tables in schema public to authenticated; grant execute on all functions in schema public to authenticated;" >/dev/null 2>&1
emp() { $P -c "set role authenticated; select set_config('request.jwt.claim.sub','$A2',false); $1" 2>&1 | grep -c "ERROR"; }
fail=0
chk() { # name expected_errors(1=거절기대,0=허용기대) actual
  if [ "$2" = "$3" ]; then echo "OK   $1"; else echo "FAIL $1 (기대 에러=$2, 실제=$3)"; fail=1; fi; }
chk "연차 approved 직접 insert 거절"  1 "$(emp "insert into public.leave_requests (user_id,start_date,end_date,days,status,tenant_id) values ('$A2',current_date,current_date+2,3,'approved','$TA')")"
chk "연차 pending insert 허용"        0 "$(emp "insert into public.leave_requests (user_id,start_date,end_date,days,tenant_id) values ('$A2',current_date,current_date,1,'$TA')")"
chk "정정 approved 직접 insert 거절"  1 "$(emp "insert into public.attendance_correction_requests (user_id,work_date,requested_clock_in_at,requested_clock_out_at,reason,status,tenant_id) values ('$A2',current_date,now(),now(),'x','approved','$TA')")"
chk "근태 90일 전 insert 거절"        1 "$(emp "insert into public.attendance_records (user_id,work_date,clock_in_at,tenant_id) values ('$A2',current_date-90,now()-interval '90 days','$TA')")"
chk "근태 오늘 현재시각 insert 허용"  0 "$(emp "insert into public.attendance_records (user_id,work_date,clock_in_at,tenant_id) values ('$A2',(now() at time zone 'Asia/Seoul')::date,now(),'$TA')")"
chk "출근시각 덮어쓰기 거절"          1 "$(emp "update public.attendance_records set clock_in_at = now()-interval '5 hours' where user_id='$A2'")"
chk "퇴근 현재시각 허용"              0 "$(emp "update public.attendance_records set clock_out_at = now() where user_id='$A2'")"
chk "퇴근 과거시각 거절"              1 "$(emp "update public.attendance_records set clock_out_at = now()-interval '3 hours' where user_id='$A2'")"
chk "문서 issued 직접 insert 거절"    1 "$(emp "insert into public.document_instances (category,title,status,rendered_body,created_by,tenant_id) values ('hr_certificate','위조','issued','x','$A2','$TA')")"
chk "문서 draft insert 허용"          0 "$(emp "insert into public.document_instances (category,title,status,rendered_body,created_by,tenant_id) values ('hr_certificate','정상','draft','x','$A2','$TA')")"
chk "타사 직원과 DM 거절"             1 "$(emp "select public.create_dm_channel('$B1')")"
chk "용량 -1TB 조작 거절"             1 "$(emp "select public.increment_tenant_file_usage(-1000000000000)")"
[ "$PRIV" = "f" ] && chk "consume 직접 호출 권한 회수" 0 0 || chk "consume 직접 호출 권한 회수" 0 1
exit $fail
