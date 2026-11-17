#!/bin/bash
# 결재 계열 함수 점검(251): 다른 회사 회수 시도 거절 / 결재선에 다른 회사 사람 거절 / 임시저장 문서 동시 제출 시 한 번만.
# 먼저 setup.sh 로 전체 스키마를 올리고 approval-race.sh 를 한 번 돌려 두 회사·사용자를 만든 뒤 실행한다.
P="psql -h /tmp/pgfull -p 5545 -U postgres -d fulldb -X -q"
A=a0000000-0000-0000-0000-000000000001; A2=a0000000-0000-0000-0000-000000000002; B=b0000000-0000-0000-0000-000000000001
TA=aaaaaaaa-0000-0000-0000-00000000000a
as() { $P -At -c "select set_config('request.jwt.claim.sub','$1',false); $2" 2>&1 | grep -i "error" | head -1; }
PR=$(cat /proc/sys/kernel/random/uuid)
$P -c "insert into public.payment_requests (id,title,requested_by,status,tenant_id,department,month_key) values ('$PR','x','$A2','pending','$TA','d','2026-01')"
echo "== 1) 다른 회사 관리자가 지급결의서 회수 =="; as $B "select public.recall_payment_request('$PR')"
$P -At -c "select status from public.payment_requests where id='$PR'"
echo "== 2) 결재선에 다른 회사 사람 =="; as $A "select public.submit_approval_document('t','c',array['$B']::uuid[])"
echo "== 3) 임시저장 동시 제출 (N=${N:-30}) =="
bad=0
for i in $(seq 1 ${N:-30}); do
 D=$(cat /proc/sys/kernel/random/uuid)
 $P -c "insert into public.approval_documents (id,title,status,created_by,tenant_id,draft_approver_ids) values ('$D','t','draft','$A','$TA',array['$A2','$A']::uuid[])"
 as $A "select public.submit_approval_draft('$D')" >/dev/null & as $A "select public.submit_approval_draft('$D')" >/dev/null & wait
 n=$($P -At -c "select count(*) from public.approval_steps where document_id='$D'")
 [ "$n" = "2" ] || { bad=$((bad+1)); echo "단계 수 어긋남: $n"; }
done
echo "어긋난 횟수: $bad"
