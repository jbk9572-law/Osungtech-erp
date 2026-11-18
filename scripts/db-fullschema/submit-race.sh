#!/bin/bash
# 지급결의서/구매요청 제출·견적요청 전환을 동시에 두 번 눌렀을 때 한 번만 처리되는지(259). approval-race.sh 를 먼저 한 번 실행해 회사·사용자를 만든다.
P="psql -h /tmp/pgfull -p 5545 -U postgres -d fulldb -X -q -At"
A=a0000000-0000-0000-0000-000000000001; A2=a0000000-0000-0000-0000-000000000002; TA=aaaaaaaa-0000-0000-0000-00000000000a
as() { $P -c "select set_config('request.jwt.claim.sub','$1',false); $2" 2>&1 | grep -i "error" | head -1; }
echo "== 지급결의서 동시 제출 (N=${N:-20}) — 결재 문서가 1개여야"
bad=0; for i in $(seq 1 ${N:-20}); do
 PR=$(cat /proc/sys/kernel/random/uuid)
 $P -c "insert into public.payment_requests (id,title,requested_by,status,tenant_id,department,month_key) values ('$PR','x','$A','draft','$TA','d$i-$RANDOM','2026-01'); insert into public.payment_request_line_items (payment_request_id,used_at,vendor,purpose,amount,sort_order,tenant_id) values ('$PR',current_date,'v','p',1000,0,'$TA')" >/dev/null 2>&1
 as $A "select public.submit_payment_request('$PR', array['$A2']::uuid[])" >/dev/null & as $A "select public.submit_payment_request('$PR', array['$A2']::uuid[])" >/dev/null & wait
 n=$($P -c "select count(*) from public.approval_documents where source_type='payment_request' and source_id='$PR'")
 [ "$n" = "1" ] || { bad=$((bad+1)); echo "   결재 문서 $n 개"; }
done; echo "   어긋난 횟수: $bad"
