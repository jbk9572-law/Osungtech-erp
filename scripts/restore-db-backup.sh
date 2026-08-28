#!/usr/bin/env bash
# db-backups 브랜치에 쌓인 pg_dump 파일을 실제 Postgres에 복원한다.
#
# 사용법:
#   ./scripts/restore-db-backup.sh <dump-file> <target-db-url>
#
# 예시 (재해복구 훈련 — 새로 만든 빈 Supabase 프로젝트에 복원해보기):
#   git fetch origin db-backups
#   git show origin/db-backups:backups/2026-08-28T170000Z.dump > /tmp/latest.dump
#   ./scripts/restore-db-backup.sh /tmp/latest.dump "postgresql://postgres:...@...pooler.supabase.com:5432/postgres"
#
# 주의:
#   - target-db-url이 가리키는 DB의 기존 데이터는 --clean 옵션 때문에
#     충돌하는 테이블/함수가 있으면 삭제 후 재생성된다. 운영 중인 DB에는
#     절대 그대로 실행하지 말 것 — 반드시 새로 만든 빈 프로젝트(재해복구
#     훈련용) 또는 이미 폐기하기로 한 DB에만 사용한다.
#   - pg_dump/pg_restore 버전은 대상 서버보다 같거나 높아야 한다. 로컬에
#     postgresql-client가 없으면 docker로 대신 실행해도 된다:
#       docker run --rm -v "$(dirname "$1"):/d" postgres:17 \
#         pg_restore --clean --if-exists --no-owner --no-privileges \
#         -d "$2" "/d/$(basename "$1")"

set -euo pipefail

if [ $# -ne 2 ]; then
  echo "사용법: $0 <dump-file> <target-db-url>" >&2
  exit 1
fi

DUMP_FILE="$1"
TARGET_DB_URL="$2"

if [ ! -f "$DUMP_FILE" ]; then
  echo "덤프 파일을 찾을 수 없습니다: $DUMP_FILE" >&2
  exit 1
fi

echo "복원 대상: $(echo "$TARGET_DB_URL" | sed -E 's#(://[^:]+):[^@]+@#\1:****@#')"
read -r -p "위 대상 DB의 충돌 테이블/함수가 삭제 후 재생성됩니다. 계속할까요? (yes 입력) " confirm
if [ "$confirm" != "yes" ]; then
  echo "취소했습니다."
  exit 1
fi

pg_restore --clean --if-exists --no-owner --no-privileges -d "$TARGET_DB_URL" "$DUMP_FILE"

echo "복원 완료. 애플리케이션에서 로그인/조회가 정상인지 확인해주세요."
