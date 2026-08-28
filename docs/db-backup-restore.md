# DB 백업 / 복원

Supabase **Free 플랜에는 Backups 메뉴 자체가 없다**(자동 백업/PITR은
Pro 플랜부터 제공). 그래서 이 저장소 안에 자체 백업 체계를 만들어뒀다.

## 어떻게 동작하나

- `.github/workflows/db-backup.yml`이 **매시 정각(하루 24회)** 자동
  실행돼 Supabase Postgres 전체를 `pg_dump`(custom format)로 떠서
  `db-backups` 브랜치에 커밋한다. `main` 브랜치 히스토리와는 완전히
  분리돼 있어서 평소 클론/배포/`git log`에는 전혀 나타나지 않는다.
  - 이 주기는 하루 거래량이 적은(매출+매입 합쳐 10건 안팎) 지금 규모를
    기준으로 정한 것이다 — GitHub Actions 무료 시간(2,000분/월 중
    약 720분만 사용)과 Supabase 무료 트래픽 한도(5GB/월, 매번 DB
    전체를 내려받으므로 DB 용량 × 실행 횟수만큼 소진됨) 둘 다 여유가
    있다고 판단했다. **거래량이나 DB 용량(특히 파일 첨부 등)이 크게
    늘어나면 이 계산을 다시 해봐야 한다** — 그렇지 않으면 트래픽
    무료 한도를 넘어 요금이 나올 수 있다.
- 최근 720개(1시간 간격 기준 약 30일치)만 남기고 오래된 파일은 자동으로
  정리된다.
- Actions 탭 > "Nightly DB backup"에서 "Run workflow"로 언제든 수동
  실행도 가능하다.

## 최초 설정 (1회만)

1. Supabase 대시보드 > **Project Settings > Database > Connection string**
   에서 **Session pooler** URI를 복사한다.
   - Direct connection이 아니라 꼭 pooler 쪽을 써야 한다 — GitHub Actions
     러너는 IPv4만 지원하는데 Supabase의 direct connection host는
     IPv6 전용이라 그대로 쓰면 접속이 안 될 수 있다.
   - **Transaction pooler는 쓰지 않는다.** pg_dump는 세션 단위 상태를
     기대하는데 transaction 모드 풀링은 그걸 보장해주지 않아서, Supabase
     공식 문서도 pg_dump/pg_restore에는 session pooler(또는 direct
     connection)를 쓰라고 명시한다. Session pooler도 IPv4 호환이라
     GitHub Actions에서 문제없이 접속된다.
   - `[YOUR-PASSWORD]` 부분은 실제 DB 비밀번호로 바꿔서 복사한다.
2. 이 저장소 **Settings > Secrets and variables > Actions**에서
   **New repository secret**으로 이름 `SUPABASE_DB_URL`, 값은 위 URI를
   등록한다. (이 값은 절대 코드나 커밋, 채팅에 직접 남기지 않는다 —
   GitHub Secrets에만 등록하면 워크플로우가 알아서 참조한다.)
3. Actions 탭에서 "Nightly DB backup" 워크플로우를 한 번 수동 실행해
   정상적으로 `db-backups` 브랜치에 커밋이 생기는지 확인한다.

## 복원하는 방법

```bash
# 1. 원하는 시점의 덤프 파일을 꺼낸다 (db-backups 브랜치의 backups/ 폴더,
#    파일명이 UTC 타임스탬프다)
git fetch origin db-backups
git show origin/db-backups:backups/2026-08-28T170000Z.dump > /tmp/restore-target.dump

# 2. 복원 대상 DB에 적용한다
./scripts/restore-db-backup.sh /tmp/restore-target.dump "<대상 DB 연결 문자열>"
```

`scripts/restore-db-backup.sh`는 `--clean`으로 복원하므로 대상 DB의
기존 테이블/함수가 충돌하면 지우고 다시 만든다. **운영 중인 DB에 그대로
실행하면 안 되고**, 아래 두 경우에만 쓴다.

- **재해복구 훈련**: 무료로 새 Supabase 프로젝트를 하나 더 만들고(2분,
  카드 등록 불필요), 그 프로젝트의 pooling 연결 문자열을 대상으로 복원해
  실제로 되살아나는지 주기적으로 확인해본다. 훈련이 끝나면 그 프로젝트는
  지워도 된다.
- **실제 재해 상황**: 기존 프로젝트가 완전히 망가졌을 때, 새 Supabase
  프로젝트(또는 같은 프로젝트를 초기화한 뒤)에 최신 백업을 복원한다.

## 한계 / 앞으로 더 할 수 있는 것

- 백업은 1시간 간격이다. 그 사이에 발생한 변경분은 복구되지 않는다 —
  더 촘촘한 주기가 필요하면 cron만 바꾸면 된다(`db-backup.yml`의
  `schedule`) — 다만 위에서 설명한 트래픽 한도를 먼저 확인할 것.
- 지금은 별도 암호화 없이 이 저장소(비공개 저장소로 가정) 안에만
  보관한다. 외부 스토리지(예: S3)에 추가로 올려 이중화하고 싶으면
  `db-backup.yml`의 "Commit and push" 단계 뒤에 업로드 스텝을 추가하면
  된다.
- 자동 복원 훈련(예: 매주 한 번, 별도 테스트 프로젝트에 자동으로
  복원해보고 기본 쿼리로 확인)까지 자동화하고 싶다면 알려주면 워크플로우를
  추가한다 — 그 경우 테스트용 Supabase 프로젝트의 연결 문자열을 별도
  시크릿(`RESTORE_TEST_DB_URL`)으로 하나 더 등록해야 한다.
