#!/usr/bin/env bash
# migration 265 검증 (setup.sh + approval-race.sh 필요): 마감일 이전 등록 차단, 월 쿼터 조회
P="psql -h /tmp/pgfull -p 5545 -U postgres -d fulldb -X -q -At"
TA=aaaaaaaa-0000-0000-0000-00000000000a; A1=a0000000-0000-0000-0000-000000000001; A2=a0000000-0000-0000-0000-000000000002
$P -c "grant usage on schema public to authenticated; grant select,insert,update,delete on all tables in schema public to authenticated; grant execute on all functions in schema public to authenticated; grant usage,select on all sequences in schema public to authenticated;" >/dev/null 2>&1
as() { $P -c "set role authenticated; select set_config('request.jwt.claim.sub','$1',false); $2" 2>&1; }
fail=0; chk() { if [ "$2" = "$3" ]; then echo "OK   $1"; else echo "FAIL $1 (기대=$2 실제=$3)"; fail=1; fi; }
err() { grep -c "ERROR"; }
$P -c "update public.tenants set closing_date = current_date - 10 where id='$TA'" >/dev/null
S=$(cat /proc/sys/kernel/random/uuid); W=$(cat /proc/sys/kernel/random/uuid)
$P -c "insert into public.suppliers (id,name,tenant_id) values ('$S','s','$TA'); insert into public.warehouses (id,name,tenant_id) values ('$W','w','$TA')" >/dev/null 2>&1
ins() { as $1 "insert into public.purchase_orders (supplier_id,warehouse_id,purchase_date,created_by) values ('$S','$W',current_date - $2,'$1')"; }
chk "직원: 마감일 이전 날짜 매입 등록 거절"   1 "$(ins $A2 20 | err)"
echo "   (확인) 마감 이전 거절 사유: $(ins $A2 20 | grep ERROR | head -1)"
chk "직원: 마감일 이후 날짜 매입 등록 허용"   0 "$(ins $A2 3 | err)"
chk "관리자: 마감일 이전 날짜 등록 허용"       0 "$(ins $A1 20 | err)"
chk "직원: 이후 날짜 건을 마감 이전으로 변경 거절" 1 "$(as $A2 "update public.purchase_orders set purchase_date = current_date - 30 where created_by='$A2'" | err)"
Q=$(as $A2 "select public.get_monthly_quota_status()" | tail -1)
echo "$Q" | grep -q '"email_quota"' && echo "OK   월 쿼터 조회 동작: $Q" || { echo "FAIL 월 쿼터 조회: $Q"; fail=1; }
exit $fail
