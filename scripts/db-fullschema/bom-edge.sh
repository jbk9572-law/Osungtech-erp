#!/bin/bash
# BOM·생산지시 경우의수 점검(실 Postgres): 자재투입/완료/삭제의 동시 처리, BOM 수정 후 삭제, 다른 회사 구성품.
# 먼저 setup.sh 로 전체 스키마를 올리고 approval-race.sh 를 한 번 돌려 두 회사·사용자를 만든 뒤 실행한다.
P="psql -h /tmp/pgfull -p 5545 -U postgres -d fulldb -X -q -At"
A=a0000000-0000-0000-0000-000000000001; B=b0000000-0000-0000-0000-000000000001
TA=aaaaaaaa-0000-0000-0000-00000000000a; TB=bbbbbbbb-0000-0000-0000-00000000000b
as() { $P -c "select set_config('request.jwt.claim.sub','$1',false); $2" 2>&1 | grep -i "error" | head -1; }
qty() { $P -c "select coalesce(sum(quantity),0) from public.inventory where product_id='$1'"; }
new_fixture() { # 완제품 F, 구성품 C1(×2), C2(×0.5), 창고, 초기재고 1000 → 변수 F C1 C2 W
  F=$(cat /proc/sys/kernel/random/uuid); C1=$(cat /proc/sys/kernel/random/uuid); C2=$(cat /proc/sys/kernel/random/uuid); W=$(cat /proc/sys/kernel/random/uuid)
  $P -c "insert into public.warehouses (id,name,tenant_id) values ('$W','W-'||substr('$W',1,6),'$TA');
         insert into public.products (id,sku,name,unit,tenant_id) values ('$F','F-'||substr('$F',1,6),'완제품','EA','$TA'),('$C1','C1-'||substr('$C1',1,6),'부품1','EA','$TA'),('$C2','C2-'||substr('$C2',1,6),'부품2','KG','$TA');
         insert into public.bom_items (parent_product_id,component_product_id,quantity_per_unit,tenant_id) values ('$F','$C1',2,'$TA'),('$F','$C2',0.5,'$TA');
         insert into public.inventory_transactions (product_id,warehouse_id,type,quantity,reference,tenant_id) values ('$C1','$W','in',1000,'init','$TA'),('$C2','$W','in',1000,'init','$TA');" >/dev/null
}
mk_wo() { WO=$(cat /proc/sys/kernel/random/uuid); $P -c "insert into public.work_orders (id,product_id,warehouse_id,quantity,order_date,created_by,tenant_id) values ('$WO','$F','$W',10,current_date,'$A','$TA')" >/dev/null; }

echo "== 1) 정상 흐름: 투입→완료→삭제 후 재고가 원래대로 (C1 1000, C2 1000, F 0 기대)"
new_fixture; mk_wo
as $A "select public.issue_work_order_materials('$WO')"; as $A "select public.complete_work_order('$WO')"
echo "   투입·완료 후: C1=$(qty $C1) C2=$(qty $C2) F=$(qty $F) (980/995/10 기대)"
as $A "select public.delete_work_order('$WO')"
echo "   삭제 후:     C1=$(qty $C1) C2=$(qty $C2) F=$(qty $F)"

echo "== 2) 자재투입 동시 2회 (한 번만 처리돼야: C1 980)"
bad=0; for i in $(seq 1 ${N:-20}); do new_fixture; mk_wo
 as $A "select public.issue_work_order_materials('$WO')" >/dev/null & as $A "select public.issue_work_order_materials('$WO')" >/dev/null & wait
 [ "$(qty $C1)" = "980" ] || { bad=$((bad+1)); echo "   이중 차감: C1=$(qty $C1)"; }; done; echo "   어긋난 횟수: $bad"

echo "== 3) 생산완료 동시 2회 (완제품 10 한 번만)"
bad=0; for i in $(seq 1 ${N:-20}); do new_fixture; mk_wo; as $A "select public.issue_work_order_materials('$WO')" >/dev/null
 as $A "select public.complete_work_order('$WO')" >/dev/null & as $A "select public.complete_work_order('$WO')" >/dev/null & wait
 [ "$(qty $F)" = "10" ] || { bad=$((bad+1)); echo "   이중 입고: F=$(qty $F)"; }; done; echo "   어긋난 횟수: $bad"

echo "== 4) 삭제 동시 2회 (투입·완료 후; 재고가 원래대로 한 번만 복구돼야: C1 1000)"
bad=0; for i in $(seq 1 ${N:-20}); do new_fixture; mk_wo; as $A "select public.issue_work_order_materials('$WO')" >/dev/null; as $A "select public.complete_work_order('$WO')" >/dev/null
 as $A "select public.delete_work_order('$WO')" >/dev/null & as $A "select public.delete_work_order('$WO')" >/dev/null & wait
 [ "$(qty $C1)" = "1000" ] && [ "$(qty $F)" = "0" ] || { bad=$((bad+1)); echo "   이중 복구: C1=$(qty $C1) F=$(qty $F)"; }; done; echo "   어긋난 횟수: $bad"

echo "== 5) 자재투입 후 BOM 수량을 바꾸고 삭제 (C1 1000 으로 돌아와야)"
new_fixture; mk_wo; as $A "select public.issue_work_order_materials('$WO')"
$P -c "update public.bom_items set quantity_per_unit=5 where parent_product_id='$F' and component_product_id='$C1'" >/dev/null
as $A "select public.delete_work_order('$WO')"; echo "   C1=$(qty $C1) (1000 기대, 현재 BOM 기준으로 되돌리면 1030)"

echo "== 6) 자재투입 후 BOM 구성품을 지우고 삭제 (C2 1000 으로 돌아와야)"
new_fixture; mk_wo; as $A "select public.issue_work_order_materials('$WO')"
$P -c "delete from public.bom_items where parent_product_id='$F' and component_product_id='$C2'" >/dev/null
as $A "select public.delete_work_order('$WO')"; echo "   C2=$(qty $C2) (1000 기대, 지워진 구성품은 복구 안 되면 995)"

echo "== 7) 다른 회사 사용자가 우리 회사 BOM/생산지시를 건드리기"
new_fixture; mk_wo
echo "   (타사) 자재투입: $(as $B "select public.issue_work_order_materials('$WO')")"
echo "   (타사) 우리 품목을 구성품으로 BOM 등록 시도: $(as $B "insert into public.bom_items (parent_product_id, component_product_id, quantity_per_unit) values ('$F','$C1',1)")"
echo "== 8) 자기 회사 BOM 에 다른 회사 품목을 구성품으로 넣기 (거절돼야)"
TBP=$(cat /proc/sys/kernel/random/uuid); $P -c "insert into public.products (id,sku,name,unit,tenant_id) values ('$TBP','TB-'||substr('$TBP',1,6),'타사품목','EA','$TB')" >/dev/null
r=$(as $A "insert into public.bom_items (parent_product_id, component_product_id, quantity_per_unit) values ('$F','$TBP',1)"); echo "   결과: ${r:-허용됨(구멍)}"

echo "== 9) 외주업체에 자재를 보낸 생산지시 삭제 (업체에 남아 있으면 거절, 소비 처리 후에는 허용)"
new_fixture
S=$(cat /proc/sys/kernel/random/uuid); PR=$(cat /proc/sys/kernel/random/uuid)
$P -c "insert into public.subcontractors (id,name,tenant_id) values ('$S','외주사','$TA');
       insert into public.production_processes (id,name,tenant_id) values ('$PR','가공','$TA');
       insert into public.product_process_routes (product_id,process_id,sort_order,tenant_id) values ('$F','$PR',1,'$TA');" >/dev/null 2>&1
WO=$(cat /proc/sys/kernel/random/uuid)
$P -c "select set_config('request.jwt.claim.sub','$A',false); select public.create_work_order('$F','$W',10,current_date)" >/dev/null 2>&1
WO=$($P -c "select id from public.work_orders where product_id='$F' order by created_at desc limit 1")
$P -c "update public.work_order_process_steps set assignee_kind='subcontractor', subcontractor_id='$S' where work_order_id='$WO'" >/dev/null 2>&1
echo "   외주 투입: $(as $A "select public.issue_work_order_materials_to_subcontractor('$WO')")  (비어 있으면 성공)"
echo "   업체 보유(C1): $($P -c "select quantity from public.subcontractor_inventory where subcontractor_id='$S' and product_id='$C1'")  우리 C1=$(qty $C1)"
echo "   삭제 시도(거절 기대): $(as $A "select public.delete_work_order('$WO')")"
$P -c "insert into public.subcontractor_inventory_transactions (subcontractor_id,product_id,type,quantity,work_order_id,tenant_id) select '$S',product_id,'consumed',quantity,work_order_id,tenant_id from public.subcontractor_inventory_transactions where work_order_id='$WO' and type='issued'" >/dev/null
echo "   소비 처리 후 삭제(성공 기대): $(as $A "select public.delete_work_order('$WO')")"; echo "   우리 C1=$(qty $C1) (1000 기대)"

echo "== 10) 재고 부족 자재투입 거절 (265): C1 필요 20 > 재고 5 → 거절, 상태/재고 불변"
new_fixture; mk_wo
$P -c "update public.inventory set quantity=5 where product_id='$C1' and warehouse_id='$W'" >/dev/null
echo "   결과: $(as $A "select public.issue_work_order_materials('$WO')")"
echo "   재고(C1=5 유지 기대): $(qty $C1)  상태(pending 기대): $($P -c "select status from public.work_orders where id='$WO'")"
