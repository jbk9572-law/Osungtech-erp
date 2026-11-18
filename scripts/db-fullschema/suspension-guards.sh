#!/usr/bin/env bash
# migration 261 검증 (setup.sh + approval-race.sh 픽스처 필요)
set -u
P="psql -h /tmp/pgfull -p 5545 -U postgres -d fulldb -X -q -At"
TA=aaaaaaaa-0000-0000-0000-00000000000a; A1=a0000000-0000-0000-0000-000000000001; A2=a0000000-0000-0000-0000-000000000002; B1=b0000000-0000-0000-0000-000000000001
$P -c "grant usage on schema public to authenticated; grant select,insert,update,delete on all tables in schema public to authenticated; grant execute on all functions in schema public to authenticated;" >/dev/null 2>&1
as() { $P -c "set role authenticated; select set_config('request.jwt.claim.sub','$1',false); $2" 2>&1; }
fail=0; chk() { if [ "$2" = "$3" ]; then echo "OK   $1"; else echo "FAIL $1 (기대=$2 실제=$3)"; fail=1; fi; }
chk "정상 회사: current_tenant_id = A"        "$TA" "$(as $A2 "select public.current_tenant_id()" | tail -1)"
$P -c "update public.tenants set disabled_at = now() where id='$TA'" >/dev/null
chk "정지 회사: current_tenant_id = null"     ""    "$(as $A2 "select public.current_tenant_id()" | tail -1)"
chk "정지 회사: 사유 = disabled"              "disabled" "$(as $A2 "select public.my_tenant_block_reason()" | tail -1)"
$P -c "update public.tenants set disabled_at = null, plan_expires_at = now() - interval '1 day' where id='$TA'" >/dev/null
chk "만료 회사: current_tenant_id = null"     ""    "$(as $A2 "select public.current_tenant_id()" | tail -1)"
chk "만료 회사: 사유 = expired"               "expired" "$(as $A2 "select public.my_tenant_block_reason()" | tail -1)"
$P -c "update public.tenants set plan_expires_at = null where id='$TA'" >/dev/null
# 가장: 일반 직원 행이 남아 있어도 플랫폼 관리자가 아니면 무시
$P -c "insert into public.platform_admin_impersonations (admin_user_id, tenant_id) values ('$A2','bbbbbbbb-0000-0000-0000-00000000000b')" >/dev/null 2>&1
chk "비관리자의 가장 행 무시"                 "$TA" "$(as $A2 "select public.current_tenant_id()" | tail -1)"
$P -c "delete from public.platform_admin_impersonations" >/dev/null
# 메신저 file_path
CH=$(as $A2 "select public.get_or_create_all_channel()" | tail -1)
chk "타사 uid 폴더 file_path 거절" 1 "$(as $A2 "insert into public.messenger_messages (channel_id,sender_id,content,file_path,tenant_id) values ('$CH','$A2','x','$B1/a.png','$TA')" | grep -c ERROR)"
chk "내 uid 폴더 file_path 허용"   0 "$(as $A2 "insert into public.messenger_messages (channel_id,sender_id,content,file_path,tenant_id) values ('$CH','$A2','x','$A2/a.png','$TA')" | grep -c ERROR)"
exit $fail
