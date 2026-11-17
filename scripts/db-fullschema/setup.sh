#!/bin/bash
# 실제 Postgres에 마이그레이션 248개 전체를 올려서 "운영과 거의 같은 스키마"를 만든다(Supabase 전용 부분은 prelude.sql의 빈 껍데기로 대신).
# pglite 테스트 하네스는 일부 테이블만 흉내 내서 샌드박스 생성(sandbox_seed) 같은 큰 함수는 못 돌린다 — 그런 함수를 고칠 때 쓴다.
# 사용: PGBIN=/usr/lib/postgresql/16/bin scripts/db-fullschema/setup.sh   (끝나면 소켓 /tmp/pgfull, 포트 5545, DB fulldb)
# 정리: su postgres -c "$PGBIN/pg_ctl -D /tmp/pgfull/data stop"; rm -rf /tmp/pgfull
set -e
BIN=${PGBIN:-/usr/lib/postgresql/16/bin}
rm -rf /tmp/pgfull && mkdir -p /tmp/pgfull && chown postgres:postgres /tmp/pgfull
su postgres -c "$BIN/initdb -D /tmp/pgfull/data -A trust >/tmp/pgfull/init.log 2>&1 && $BIN/pg_ctl -D /tmp/pgfull/data -o '-p 5545 -k /tmp/pgfull -c listen_addresses=' -l /tmp/pgfull/pg.log start"
sleep 2
P="psql -h /tmp/pgfull -p 5545 -U postgres"
$P -c "create database fulldb" >/dev/null
$P -d fulldb -q -f "$(dirname "$0")/prelude.sql" >/dev/null 2>&1 || true
for f in supabase/migrations/*.sql; do
  n=$(basename "$f" | sed 's/^0*//;s/_.*//')
  # 099(멀티테넌트 전환)는 원래 있던 "오성테크" 회사 행을 전제로 하므로 새 DB에는 미리 넣어 준다
  if [ "$n" = "99" ]; then $P -d fulldb -q -c "insert into public.tenants (name) values ('오성테크')" >/dev/null; fi
  $P -d fulldb -q -X -f "$f" 2>&1 | grep ERROR | head -2 || true
done
# 121은 slug가 null이면 실패하므로 채운 뒤 다시 적용한다(이미 있는 제약 중복 오류 1건은 무시)
$P -d fulldb -q -c "update public.tenants set slug='osungtech' where slug is null" >/dev/null
$P -d fulldb -q -X -f supabase/migrations/00000000000121_tenant_slug_and_platform_admin.sql >/dev/null 2>&1 || true
echo "완료: psql -h /tmp/pgfull -p 5545 -U postgres -d fulldb"
echo "샌드박스 시험: 관리자 계정이 속한 회사를 is_sandbox=true로 바꾸고 request.jwt.claim.sub를 그 계정 id로 설정한 뒤 select public.sandbox_seed_stage(n)"
