#!/usr/bin/env bash
# migration 266 검증: 재고 부족 차단 + 정상 흐름(샌드박스 더미 생성, 매입 수량 늘리기/줄이기, 판매, 반품) 영향 확인
P="psql -h /tmp/pgfull -p 5545 -U postgres -d fulldb -X -q -At"
TA=aaaaaaaa-0000-0000-0000-00000000000a; A1=a0000000-0000-0000-0000-000000000001; A2=a0000000-0000-0000-0000-000000000002
$P -c "grant usage on schema public to authenticated; grant select,insert,update,delete on all tables in schema public to authenticated; grant execute on all functions in schema public to authenticated; grant usage,select on all sequences in schema public to authenticated;" >/dev/null 2>&1
as() { $P -c "set role authenticated; select set_config('request.jwt.claim.sub','$1',false); $2" 2>&1; }
fail=0; chk() { if [ "$2" = "$3" ]; then echo "OK   $1"; else echo "FAIL $1 (기대=$2 실제=$3)"; fail=1; fi; }
err() { grep -c "ERROR"; }
echo "== 1) 샌드박스 더미 데이터 11단계 생성이 막히지 않는가"
$P -c "update public.tenants set is_sandbox = true where id='$TA'" >/dev/null
N=$($P -c "select public.sandbox_seed_stage_count()")
bad=0; for s in $(seq 1 $N); do r=$($P -c "select set_config('request.jwt.claim.sub','$A1',false); select public.sandbox_seed_stage($s)" 2>&1 | grep -i "error" | head -1); [ -z "$r" ] || { bad=$((bad+1)); echo "   단계 $s: $r"; }; done
chk "더미 생성 단계 오류 0건 (총 $N단계)" 0 "$bad"
for ind in food retail service; do r=$($P -c "select set_config('request.jwt.claim.sub','$A1',false); select public.sandbox_seed_industry('$ind')" 2>&1 | grep -i "error" | head -1); echo "   업종 예시 $ind: ${r:-성공}"; [ -z "$r" ] || fail=1; done
echo "   (샌드박스 밖에서는 seed_mode 가 꺼져 있어 일반 차단이 적용된다)"
$P -c "update public.tenants set is_sandbox = false where id='$TA'" >/dev/null
echo "== 2) 매입·판매 흐름"
S=$(cat /proc/sys/kernel/random/uuid); C=$(cat /proc/sys/kernel/random/uuid); W=$(cat /proc/sys/kernel/random/uuid); PR=$(cat /proc/sys/kernel/random/uuid)
$P -c "insert into public.suppliers (id,name,tenant_id) values ('$S','s','$TA'); insert into public.customers (id,name,tenant_id) values ('$C','c','$TA'); insert into public.warehouses (id,name,tenant_id) values ('$W','w','$TA'); insert into public.products (id,sku,name,unit,tenant_id) values ('$PR','SKU'||substr('$PR',1,8),'상품','EA','$TA')" >/dev/null
buy() { as $A2 "select public.create_purchase_with_items('$S','$W',current_date,null,'$A2','[{\"productId\":\"$PR\",\"quantity\":$1,\"unitCost\":100,\"lotNumber\":null}]'::jsonb)" | tr -d '\n'; }
sell() { as $A2 "select public.create_sale_with_items('$C','$W',current_date,null,'$A2','[{\"productId\":\"$PR\",\"quantity\":$1,\"unitPrice\":200,\"lotNumber\":null}]'::jsonb)"; }
stock() { $P -c "select coalesce(sum(quantity),0) from public.inventory where product_id='$PR'"; }
PO=$(buy 10 | tail -c 36); echo "   매입 10 → 재고 $(stock)"
chk "재고 10에서 판매 4 허용"                   0 "$(sell 4 | err)"
chk "재고 6에서 판매 7 거절(재고 부족)"          1 "$(sell 7 | err)"
echo "   거절 사유: $(sell 7 | grep ERROR | head -1)"
chk "거절 후 재고 6 유지"                        6 "$(stock | cut -d. -f1)"
chk "재고 6에서 판매 6(전량) 허용"               0 "$(sell 6 | err)"
echo "== 3) 일부 팔린 뒤 전표 수정 (매입 10 / 판매 4+6 = 재고 0 상태에서 시작해 새로 구성)"
PR2=$(cat /proc/sys/kernel/random/uuid); $P -c "insert into public.products (id,sku,name,unit,tenant_id) values ('$PR2','SKU'||substr('$PR2',1,8),'상품2','EA','$TA')" >/dev/null
PRO=$PR2
buy2() { as $A2 "select public.create_purchase_with_items('$S','$W',current_date,null,'$A2','[{\"productId\":\"$PRO\",\"quantity\":$1,\"unitCost\":100,\"lotNumber\":null}]'::jsonb)" | tr -d '\n'; }
sell2() { as $A2 "select public.create_sale_with_items('$C','$W',current_date,null,'$A2','[{\"productId\":\"$PRO\",\"quantity\":$1,\"unitPrice\":200,\"lotNumber\":null}]'::jsonb)" | tr -d '\n'; }
stock2() { $P -c "select coalesce(sum(quantity),0) from public.inventory where product_id='$PRO'" | cut -d. -f1; }
POID=$(buy2 10 | tail -c 36); SOID=$(sell2 4 | tail -c 36); echo "   매입 10, 판매 4 → 재고 $(stock2) (6 기대)"
upd_buy() { as $A2 "select public.update_purchase_with_items('$POID','$S','$W',current_date,null,'$A2','[{\"productId\":\"$PRO\",\"quantity\":$1,\"unitCost\":100,\"lotNumber\":null}]'::jsonb)"; }
upd_sell() { as $A2 "select public.update_sale_with_items('$SOID','$C','$W',current_date,null,'$A2','[{\"productId\":\"$PRO\",\"quantity\":$1,\"unitPrice\":200,\"lotNumber\":null}]'::jsonb)"; }
chk "일부 팔린 매입은 수정 불가(기존 규칙 유지)"        1 "$(upd_buy 12 | err)"
chk "수정 거절 후 재고 6 유지"                        6 "$(stock2)"
chk "판매 4→5 (재고 충분) 허용"                      0 "$(upd_sell 5 | err)"
chk "재고 5 확인"                                    5 "$(stock2)"
chk "판매 5→20 (재고 부족) 거절"                     1 "$(upd_sell 20 | err)"
chk "거절 후 재고 5 유지"                            5 "$(stock2)"
chk "판매 5→2 (줄이기) 허용 → 재고 8"                 8 "$(upd_sell 2 >/dev/null; stock2)"
echo "   (참고) 회사 스위치를 켜면 음수 허용:"
$P -c "update public.tenants set allow_negative_stock = true where id='$TA'" >/dev/null
chk "스위치 켠 회사: 재고 0에서 판매 3 허용"      0 "$(sell 3 | err)"
$P -c "update public.tenants set allow_negative_stock = false where id='$TA'" >/dev/null
exit $fail
