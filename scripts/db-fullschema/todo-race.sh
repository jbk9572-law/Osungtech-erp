#!/bin/bash
# 할일 완료 함수 점검(252): (1) 다른 회사의 할일 완료 뒤집기 거절 (2) '매입+매출' 할일의 두 쪽을 동시에 완료할 때 완료 표시가 사라지지 않는지.
# 먼저 setup.sh 로 전체 스키마를 올리고 approval-race.sh 를 한 번 돌려 두 회사·사용자를 만든 뒤 실행한다.
P="psql -h /tmp/pgfull -p 5545 -U postgres -d fulldb -X -q"
A=a0000000-0000-0000-0000-000000000001; A2=a0000000-0000-0000-0000-000000000002; B=b0000000-0000-0000-0000-000000000001
TA=aaaaaaaa-0000-0000-0000-00000000000a
as() { $P -At -c "select set_config('request.jwt.claim.sub','$1',false); $2" 2>&1 | grep -i "error" | head -1; }
T=$(cat /proc/sys/kernel/random/uuid)
$P -c "insert into public.todos (id,title,created_by,todo_type,tenant_id) values ('$T','x','$A','both','$TA')"
echo "== 1) 다른 회사 사용자가 할일 완료 뒤집기 =="; as $B "select public.toggle_todo_done('$T')"
$P -At -c "select 'done='||done from public.todos where id='$T'"
echo "== 2) 매입 쪽·매출 쪽 동시 완료 (N=${N:-60}) =="
bad=0
for i in $(seq 1 ${N:-60}); do
 T=$(cat /proc/sys/kernel/random/uuid)
 $P -c "insert into public.todos (id,title,created_by,todo_type,tenant_id) values ('$T','x','$A','both','$TA')"
 as $A "select public.mark_todo_side_done('$T','purchase')" >/dev/null & as $A2 "select public.mark_todo_side_done('$T','sale')" >/dev/null & wait
 r=$($P -At -c "select done::text||'/'||(purchase_done_at is not null)::text||'/'||(sale_done_at is not null)::text from public.todos where id='$T'")
 [ "$r" = "true/true/true" ] || { bad=$((bad+1)); echo "완료 표시 사라짐: $r"; }
done
echo "어긋난 횟수: $bad"
