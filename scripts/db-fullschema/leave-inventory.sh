#!/usr/bin/env bash
# migration 262 검증: 연차 신청 보강 + 재고 직접 쓰기 차단 + 창고 이동 (setup.sh + approval-race.sh 필요)
P="psql -h /tmp/pgfull -p 5545 -U postgres -d fulldb -X -q -At"
TA=aaaaaaaa-0000-0000-0000-00000000000a; TB=bbbbbbbb-0000-0000-0000-00000000000b
A1=a0000000-0000-0000-0000-000000000001; A2=a0000000-0000-0000-0000-000000000002; B1=b0000000-0000-0000-0000-000000000001
$P -c "grant usage on schema public to authenticated; grant select,insert,update,delete on all tables in schema public to authenticated; grant execute on all functions in schema public to authenticated;" >/dev/null 2>&1
as() { $P -c "set role authenticated; select set_config('request.jwt.claim.sub','$1',false); $2" 2>&1; }
fail=0; chk() { if [ "$2" = "$3" ]; then echo "OK   $1"; else echo "FAIL $1 (기대=$2 실제=$3)"; fail=1; fi; }
err() { grep -c "ERROR"; }
Y=$(date +%Y)
$P -c "insert into public.leave_balances (user_id,year,total_days,tenant_id) values ('$A2',$Y,3,'$TA') on conflict do nothing" >/dev/null
L() { as $A2 "select public.submit_leave_request('$Y-06-$1'::date,'$Y-06-$2'::date,$3,'x',array['$A1']::uuid[])" | err; }
chk "정상 신청(2일) 허용"                     0 "$(L 10 11 2)"
chk "겹치는 기간 신청 거절"                   1 "$(L 11 12 1)"
chk "대기 중 2일 + 신규 2일 > 총 3일 거절"    1 "$(L 20 21 2)"
chk "1일 더(총 3일) 허용"                     0 "$(L 20 20 1)"
chk "NaN 일수 거절"                           1 "$(L 25 25 "'NaN'::numeric")"
chk "기간(1일)보다 큰 일수 거절"              1 "$(L 26 26 5)"
# 재고 직접 쓰기
PROD=$(cat /proc/sys/kernel/random/uuid); WH1=$(cat /proc/sys/kernel/random/uuid); WH2=$(cat /proc/sys/kernel/random/uuid); WHB=$(cat /proc/sys/kernel/random/uuid)
$P -c "insert into public.products (id,sku,name,tenant_id) values ('$PROD','S'||substr('$PROD',1,8),'p','$TA'); insert into public.warehouses (id,name,tenant_id) values ('$WH1','w1','$TA'),('$WH2','w2','$TA'),('$WHB','wb','$TB')" >/dev/null 2>&1
as $A2 "insert into public.inventory_transactions (product_id,warehouse_id,type,quantity) values ('$PROD','$WH1','in',10)" | head -3
chk "원장으로 재고 10 반영"                   10 "$($P -c "select quantity from public.inventory where product_id='$PROD' and warehouse_id='$WH1'" | cut -d. -f1)"
chk "직원이 재고 수량 직접 update 거절"        1 "$(as $A2 "update public.inventory set quantity = 999999 where product_id='$PROD'" | err)"
chk "직원이 재고 직접 insert 거절"            1 "$(as $A2 "insert into public.inventory (product_id,warehouse_id,quantity,tenant_id) values ('$PROD','$WH2',500,'$TA')" | err)"
chk "창고 이동(정상 4개) 허용"                0 "$(as $A2 "select public.create_stock_transfer_with_items('$WH1','$WH2',current_date,null,'[{\"productId\":\"$PROD\",\"quantity\":4}]'::jsonb)" | err)"
chk "같은 품목 두 줄 합계(4+4>6) 거절"        1 "$(as $A2 "select public.create_stock_transfer_with_items('$WH1','$WH2',current_date,null,'[{\"productId\":\"$PROD\",\"quantity\":4},{\"productId\":\"$PROD\",\"quantity\":4}]'::jsonb)" | err)"
chk "타사 창고로 이동 거절"                   1 "$(as $A2 "select public.create_stock_transfer_with_items('$WH1','$WHB',current_date,null,'[{\"productId\":\"$PROD\",\"quantity\":1}]'::jsonb)" | err)"
chk "수량 0 이동 거절"                        1 "$(as $A2 "select public.create_stock_transfer_with_items('$WH1','$WH2',current_date,null,'[{\"productId\":\"$PROD\",\"quantity\":0}]'::jsonb)" | err)"
exit $fail
