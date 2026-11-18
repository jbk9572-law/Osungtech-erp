#!/usr/bin/env bash
# migration 263 검증 (setup.sh + approval-race.sh 필요)
P="psql -h /tmp/pgfull -p 5545 -U postgres -d fulldb -X -q -At"
TA=aaaaaaaa-0000-0000-0000-00000000000a
A1=a0000000-0000-0000-0000-000000000001; A2=a0000000-0000-0000-0000-000000000002
$P -c "grant usage on schema public to authenticated; grant select,insert,update,delete on all tables in schema public to authenticated; grant execute on all functions in schema public to authenticated;" >/dev/null 2>&1
as() { $P -c "set role authenticated; select set_config('request.jwt.claim.sub','$1',false); $2" 2>&1; }
fail=0; chk() { if [ "$2" = "$3" ]; then echo "OK   $1"; else echo "FAIL $1 (기대=$2 실제=$3)"; fail=1; fi; }
err() { grep -c "ERROR"; }
PR=$(cat /proc/sys/kernel/random/uuid); PR2=$(cat /proc/sys/kernel/random/uuid)
$P -c "insert into public.payment_requests (id,title,requested_by,status,tenant_id,department,month_key) values ('$PR','x','$A2','draft','$TA','d$RANDOM','2026-01'),('$PR2','y','$A1','draft','$TA','e$RANDOM','2026-01')" >/dev/null 2>&1
chk "본인 초안에 내역 추가 허용"              0 "$(as $A2 "insert into public.payment_request_line_items (payment_request_id,used_at,vendor,purpose,amount,sort_order) values ('$PR',current_date,'v','p',1000,0)" | err)"
chk "남의 결의서에 내역 추가 거절"            1 "$(as $A2 "insert into public.payment_request_line_items (payment_request_id,used_at,vendor,purpose,amount,sort_order) values ('$PR2',current_date,'v','p',1000,0)" | err)"
chk "상태를 approved 로 직접 변경 거절"       1 "$(as $A2 "update public.payment_requests set status='approved' where id='$PR'" | err)"
chk "초안→pending 변경 허용(제출)"            0 "$(as $A2 "update public.payment_requests set status='pending' where id='$PR'" | err)"
$P -c "update public.payment_requests set status='approved' where id='$PR'" >/dev/null
chk "승인 문서 내용 수정 거절"                1 "$(as $A2 "update public.payment_requests set title='바꿈' where id='$PR'" | err)"
chk "승인 문서에 내역 추가 거절"              1 "$(as $A2 "insert into public.payment_request_line_items (payment_request_id,used_at,vendor,purpose,amount,sort_order) values ('$PR',current_date,'v','p',1,1)" | err)"
chk "관리자는 상태 변경 가능"                 0 "$(as $A1 "update public.payment_requests set status='rejected' where id='$PR'" | err)"
exit $fail
