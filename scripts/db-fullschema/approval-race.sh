#!/bin/bash
# 결재 처리 함수 점검: (1) 다른 회사 관리자의 결재 시도 거절 (2) 승인 vs 반려 동시 처리 시 문서/단계 상태 일치. 먼저 setup.sh 로 전체 스키마를 올린 뒤 실행.
P="psql -h /tmp/pgfull -p 5545 -U postgres -d fulldb -X -q -v ON_ERROR_STOP=0"
$P <<'S' >/dev/null 2>&1
insert into public.tenants (id,name,slug) values ('aaaaaaaa-0000-0000-0000-00000000000a','A사','tenant-a'),('bbbbbbbb-0000-0000-0000-00000000000b','B사','tenant-b') on conflict do nothing;
do $$ begin
 perform set_config('session_replication_role','replica',true);
 insert into auth.users (id) values ('a0000000-0000-0000-0000-000000000001'),('a0000000-0000-0000-0000-000000000002'),('b0000000-0000-0000-0000-000000000001') on conflict do nothing;
end $$;
insert into public.profiles (id, full_name, role, tenant_id) values
 ('a0000000-0000-0000-0000-000000000001','A관리자','admin','aaaaaaaa-0000-0000-0000-00000000000a'),
 ('a0000000-0000-0000-0000-000000000002','A결재자','staff','aaaaaaaa-0000-0000-0000-00000000000a'),
 ('b0000000-0000-0000-0000-000000000001','B관리자','admin','bbbbbbbb-0000-0000-0000-00000000000b') on conflict do nothing;
insert into public.tenant_members (user_id, tenant_id) values
 ('a0000000-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-00000000000a'),
 ('a0000000-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-00000000000a'),
 ('b0000000-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-00000000000b') on conflict do nothing;
S
$P -c "select count(*) as users from public.tenant_members where tenant_id in ('aaaaaaaa-0000-0000-0000-00000000000a','bbbbbbbb-0000-0000-0000-00000000000b')"
mk() { $P -At <<S
insert into public.approval_documents (id,title,status,created_by,tenant_id) values ('$1','t','pending','a0000000-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-00000000000a');
insert into public.approval_steps (id,document_id,step_order,approver_id,tenant_id,role) values ('$2','$1',1,'a0000000-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-00000000000a','approver');
S
}
call() { # uid step decision
 $P -At -c "select set_config('request.jwt.claim.sub','$1',false); select public.decide_approval_step('$2','$3')" 2>&1 | grep -i "error" | head -1
}
echo "== 1) 다른 회사 관리자가 결재 시도 =="
D=$(cat /proc/sys/kernel/random/uuid); S=$(cat /proc/sys/kernel/random/uuid); mk $D $S >/dev/null
call b0000000-0000-0000-0000-000000000001 $S approved
$P -At -c "select status from public.approval_documents where id='$D'"
echo "== 2) 승인 vs 반려 동시 (N=${N:-40}) =="
bad=0
for i in $(seq 1 ${N:-40}); do
 D=$(cat /proc/sys/kernel/random/uuid); S=$(cat /proc/sys/kernel/random/uuid); mk $D $S >/dev/null
 call a0000000-0000-0000-0000-000000000001 $S approved >/dev/null & 
 call a0000000-0000-0000-0000-000000000002 $S rejected >/dev/null &
 wait
 r=$($P -At -c "select d.status||'/'||s.status from public.approval_documents d join public.approval_steps s on s.document_id=d.id where d.id='$D'")
 case "$r" in approved/approved|rejected/rejected) ;; *) bad=$((bad+1)); echo "어긋남: $r";; esac
done
echo "어긋난 횟수: $bad"
