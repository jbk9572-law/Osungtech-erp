# DB 동시성 시험 (두 명이 같은 순간에 저장·수정·삭제)

일반 테스트(pglite)는 한 번에 한 세션만 돌아서 "두 명이 동시에"를 재현하지 못한다. 이 폴더는 **진짜 Postgres**에서 두 세션을 같은 순간에 출발시켜 같은 데이터를 건드리는 시험이다.
CI에는 넣지 않았다(진짜 Postgres 서버가 필요하고 느리다) — 매입/매출/재고 DB 함수(`create/update/delete_*_with_items`, `consume_fifo_layers` 등)를 고친 뒤 직접 돌린다.

## 시나리오 (`run.sh <번호>`)
1. 두 명이 같은 입고분(100개)에서 각각 70개 출고
2. 두 명이 같은 입고 품목(50개)을 각각 30개씩 불러오기 (둘 중 하나는 거절돼야 함 — 242 마이그레이션의 합계 검사)
3. 두 명이 같은 매출을 동시에 서로 다른 수량으로 수정
4. 두 명이 같은 매출을 동시에 삭제 (더블클릭) — 둘째는 "찾을 수 없습니다"로 끝나야 함 (247 마이그레이션의 행 잠금)
5. 입고 삭제 vs 동시에 출고 등록
6. 입고 수량 수정 vs 동시에 출고 등록

매 회 끝에 불변 규칙(남은 수량 범위/일치, 소진 합 ≤ 매출 수량, 재고 이력 순합계)을 검사해 위반 횟수를 센다. 위반 0이 정상이다.

## 실행 방법 (임시 Postgres를 띄웠다가 지운다)
```bash
BIN=/usr/lib/postgresql/16/bin          # initdb/pg_ctl이 있는 곳(Ubuntu postgresql-16)
mkdir -p /tmp/pgconc && chown postgres /tmp/pgconc
su postgres -c "$BIN/initdb -D /tmp/pgconc/data -A trust && $BIN/pg_ctl -D /tmp/pgconc/data -o '-p 5544 -k /tmp/pgconc -c listen_addresses=' -l /tmp/pgconc/pg.log start"
psql -h /tmp/pgconc -p 5544 -U postgres -c "create database conc"

# 테스트용 스키마 + 최신 DB 함수 SQL을 뽑아서 올린다 (pglite 하네스와 같은 정의를 쓴다)
DUMP_OUT=/tmp/pgconc/setup.sql npx vitest run src/lib/db-tests/dump-setup.test.ts
psql -h /tmp/pgconc -p 5544 -U postgres -d conc -v ON_ERROR_STOP=1 -q -f /tmp/pgconc/setup.sql

N=30 scripts/db-concurrency/run.sh 4    # 시나리오 4를 30회
su postgres -c "$BIN/pg_ctl -D /tmp/pgconc/data stop"; rm -rf /tmp/pgconc
```
(`run.sh`가 임시 파일을 `/tmp/pgconc`에 쓰므로 위 경로를 그대로 쓴다. 다른 위치면 `PGSOCK`, `PGPORT` 환경변수로 바꾼다.)

## 지금까지 찾은 것
- 2026-11-17: 같은 전표 동시 삭제 시 재고가 이중으로 되돌려짐(15회 중 1회 재고 이력 20개 어긋남, 나머지는 DB 제약 오류) → 247에서 행 잠금으로 수정. 입고 삭제/수정과 동시 출고의 DB 내부 오류 문구도 같이 정리.
