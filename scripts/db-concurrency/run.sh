#!/bin/bash
# 사용법은 scripts/db-concurrency/README.md 참고. N=반복 횟수(기본 30), 인자는 시나리오 번호 1~6.
# 실제 Postgres에서 두 세션이 같은 순간에 같은 데이터를 건드리는 상황을 반복 시험한다.
PSQL="psql -h "${PGSOCK:-/tmp/pgconc}" -p "${PGPORT:-5544}" -U postgres -d conc -X -q -t -A -v ON_ERROR_STOP=0"
TEN=aaaaaaaa-0000-0000-0000-000000000001; ST=aaaaaaaa-0000-0000-0000-000000000002; AD=aaaaaaaa-0000-0000-0000-000000000003
WH=aaaaaaaa-0000-0000-0000-000000000004; CU=aaaaaaaa-0000-0000-0000-000000000005; SU=aaaaaaaa-0000-0000-0000-000000000006; PR=aaaaaaaa-0000-0000-0000-000000000007
seed(){
 $PSQL <<SQL >/dev/null 2>&1
 truncate public.fifo_consumptions, public.inventory_transactions, public.sales_order_items, public.sales_orders, public.purchase_order_items, public.purchase_orders, public.products, public.warehouses, public.customers, public.suppliers, public.tenant_members, public.profiles, public.tenants cascade;
 insert into public.tenants (id) values ('$TEN');
 insert into public.profiles (id, role) values ('$ST','staff'),('$AD','admin');
 insert into public.tenant_members (user_id, tenant_id) values ('$ST','$TEN'),('$AD','$TEN');
 insert into public.warehouses (id) values ('$WH'); insert into public.customers (id) values ('$CU'); insert into public.suppliers (id) values ('$SU');
 insert into public.products (id, name, cost) values ('$PR','P',100);
SQL
}
sess(){ # sess <sub> <sql> : T0 시각까지 기다렸다가 동시에 실행
 $PSQL -c "select set_config('request.jwt.claim.sub','$1',false)" -c "select pg_sleep(greatest(0, $T0 - extract(epoch from clock_timestamp())))" -c "$2" 2>&1 | grep -v "^$" | tr '\n' ' '
}
purchase_sql(){ echo "select public.create_purchase_with_items(p_supplier_id => '$SU', p_warehouse_id => '$WH', p_purchase_date => '2026-11-01', p_memo => null, p_created_by => '$ST', p_items => '[{\"productId\":\"$PR\",\"quantity\":$1,\"unitCost\":150}]'::jsonb)"; }
sale_sql(){ echo "select public.create_sale_with_items(p_customer_id => '$CU', p_warehouse_id => '$WH', p_order_date => '2026-11-02', p_memo => null, p_created_by => '$ST', p_items => '[{\"productId\":\"$PR\",\"quantity\":$1,\"unitPrice\":300$2}]'::jsonb)"; }
INV="select
 (select count(*) from public.purchase_order_items where remaining_quantity < 0 or remaining_quantity > quantity) as r1_range,
 (select count(*) from public.purchase_order_items poi where abs(poi.quantity - poi.remaining_quantity - coalesce((select sum(consumed_quantity) from public.fifo_consumptions fc where fc.purchase_order_item_id = poi.id),0)) > 0.000001) as r1_mismatch,
 (select count(*) from public.sales_order_items s where coalesce((select sum(consumed_quantity) from public.fifo_consumptions fc where fc.sales_order_item_id = s.id),0) > s.quantity + 0.000001) as r2_over,
 (select coalesce(sum(case type when 'in' then quantity when 'out' then -quantity else quantity end),0) from public.inventory_transactions) - ((select coalesce(sum(quantity),0) from public.purchase_order_items) - (select coalesce(sum(quantity),0) from public.sales_order_items)) as r3_diff"
check_inv(){ $PSQL -F, -c "$INV"; }
N=${N:-30}
declare -A bad errs
run_case(){ # name, setup-fn, A-sql-fn, B-sql-fn
 name=$1; local viol=0; local errc=0; local extra=""
 for i in $(seq 1 $N); do
  seed; $2
  T0=$(python3 -c "import time;print(time.time()+0.9)")
  ( ra=$(sess $ST "$($3)"); echo "$ra" > /tmp/pgconc/ra ) & ( rb=$(sess $ST "$($4)"); echo "$rb" > /tmp/pgconc/rb ) & wait
  v=$(check_inv); IFS=, read a b c d <<< "$v"
  if [ "$a" != "0" ] || [ "$b" != "0" ] || [ "$c" != "0" ] || [ "$d" != "0" ]; then viol=$((viol+1)); extra="$v"; fi
  grep -qi "ERROR" /tmp/pgconc/ra /tmp/pgconc/rb && errc=$((errc+1))
  grep -hoi "ERROR:[^|]*" /tmp/pgconc/ra /tmp/pgconc/rb | cut -c1-110 >> /tmp/pgconc/errs.txt
  if [ "$i" = "1" ]; then s1="A: $(cat /tmp/pgconc/ra | cut -c1-110) || B: $(cat /tmp/pgconc/rb | cut -c1-110)"; fi
 done
 echo "[$name] ${N}회: 불변규칙 위반 ${viol}회, 한쪽이 거절/오류로 끝난 횟수 ${errc}회  (위반 예: ${extra:-없음})"
 echo "     1회차 결과 → $s1"
 [ -s /tmp/pgconc/errs.txt ] && { echo "     오류 문구:"; sort /tmp/pgconc/errs.txt | uniq -c | sed "s/^/       /"; }; rm -f /tmp/pgconc/errs.txt
}

mkp(){ $PSQL -c "select set_config('request.jwt.claim.sub','$ST',false)" -c "$(purchase_sql $1)" >/dev/null 2>&1; }
mks(){ $PSQL -t -A -c "select set_config('request.jwt.claim.sub','$ST',false)" -c "$(sale_sql $1 "$2")" 2>&1 | tail -1; }
upd_sale_sql(){ echo "select public.update_sale_with_items(p_id => '$SID', p_customer_id => '$CU', p_warehouse_id => '$WH', p_order_date => '2026-11-02', p_memo => null, p_updated_by => '$ST', p_items => '[{\"productId\":\"$PR\",\"quantity\":$1,\"unitPrice\":300}]'::jsonb)"; }

s1(){ mkp 100; }
a1(){ sale_sql 70; }
s2(){ mkp 50; PI=$($PSQL -c "select id from public.purchase_order_items limit 1"); }
a2(){ sale_sql 30 ",\"sourcePurchaseItemId\":\"$PI\""; }
s3(){ mkp 100; SID=$(mks 20 ""); }
a3(){ upd_sale_sql 50; }; b3(){ upd_sale_sql 30; }
a4(){ echo "select public.delete_sale_with_items('$SID','$ST')"; }
s5(){ mkp 100; PID=$($PSQL -c "select id from public.purchase_orders limit 1"); }
a5(){ echo "select public.delete_purchase_with_items('$PID','$ST')"; }
b5(){ sale_sql 40; }
a6(){ echo "select public.update_purchase_with_items(p_id => '$PID', p_supplier_id => '$SU', p_warehouse_id => '$WH', p_purchase_date => '2026-11-01', p_memo => null, p_updated_by => '$ST', p_items => '[{\"productId\":\"$PR\",\"quantity\":30,\"unitCost\":150}]'::jsonb)"; }

case "$1" in
 1) run_case "두 명이 같은 입고분(100개)에서 각각 70개 출고" s1 a1 a1 ;;
 2) run_case "두 명이 같은 입고 품목(50개)을 각각 30개씩 불러오기" s2 a2 a2 ;;
 3) run_case "두 명이 같은 매출을 동시에 서로 다른 수량으로 수정" s3 a3 b3 ;;
 4) run_case "두 명이 같은 매출을 동시에 삭제(더블클릭)" s3 a4 a4 ;;
 5) run_case "입고 삭제 vs 동시에 출고 등록" s5 a5 b5 ;;
 6) run_case "입고 수량 수정 vs 동시에 출고 등록" s5 a6 b5 ;;
esac
