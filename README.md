# Osungtech ERP

지업/필터 도매업체(오성테크)를 위한 사내 전용 ERP입니다. 매출/매입/재고
관리를 중심으로, 이 회사의 실제 업무 흐름(모조지 계산, 카톡 복사용 텍스트,
이월 처리, 지급결의서 등)에 맞춰 계속 확장해온 자체 개발 시스템입니다.
범용 ERP가 아니라 이 회사 전용으로 튜닝돼 있습니다.

## 스택

- Next.js 16 (App Router, Server Actions, Turbopack)
- React 19
- Supabase (Auth, Postgres, RLS) — DB/인증/파일저장을 전담
- Vitest (단위 테스트)

## 배포 구조 (중요)

**호스팅(화면을 실행하는 서버)과 데이터베이스는 완전히 분리돼 있습니다.**

- **호스팅**: Netlify. `main` 브랜치에 push되면 자동으로 빌드·배포됩니다.
  (예전에는 Vultr VPS + Coolify + Caddy로도 동시에 운영했으나, 두 호스팅이
  서로 다른 시점의 코드로 어긋나는 문제가 반복돼 Netlify 하나로 정리했습니다.
  자세한 이전 절차는 `docs/netlify-deploy.md` 참고.)
- **데이터베이스**: Supabase. 호스팅이 무엇이든(넷리파이, Vultr, 로컬 개발
  서버) 전부 같은 Supabase 프로젝트 하나를 보고 있습니다. 즉 호스팅을
  바꿔도 데이터는 그대로입니다.
- **DB 백업**: Supabase Free 플랜엔 자동 백업이 없어서, GitHub Actions로
  매시간 자체 백업을 돌립니다. 절차는 `docs/db-backup-restore.md` 참고
  (복원 방법 포함).

## 시작하기 (로컬 개발)

1. Supabase 프로젝트를 만듭니다.
2. `.env.local.example`을 `.env.local`로 복사하고 값을 채웁니다.

   ```bash
   cp .env.local.example .env.local
   ```

   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase
     대시보드 > Project Settings > API에서 복사
   - `SUPABASE_SERVICE_ROLE_KEY`: 같은 화면의 service_role 키. 관리자
     기능(계정 생성, 아이디 기반 로그인 조회, 백업 내보내기 등)에만 서버
     쪽에서 쓰이고 브라우저로는 절대 노출되지 않습니다.

3. 의존성 설치 후 마이그레이션을 적용합니다.

   ```bash
   npm install
   npx supabase link --project-ref <project-ref>
   npx supabase db push
   ```

4. 개발 서버 실행: `npm run dev` → [http://localhost:3000](http://localhost:3000)

## 스크립트

```bash
npm run dev     # 개발 서버
npm run build   # 프로덕션 빌드
npm run start   # 프로덕션 서버
npm run lint    # ESLint
npm run test    # Vitest 단위 테스트
```

## 주요 기능

- **매출/매입 관리**: 등록·수정·삭제, 반품(사유 코드화), 이월(다음 달
  실적으로 잡기), 카드/현금 등 결제방법, 배송/입고방법, 엑셀 다운로드
  (거래처별 전용 서식 포함)
- **재고관리**: 창고 1곳 기준 실시간 재고, 재고 조정(기초재고 등록 등),
  재고실사(전체 품목 일괄 대조), 재고 부족 자동 발주 제안
- **모조지(용지) 계산기**: 재단 배치 계산, 매출/매입 품목에 자동 반영,
  수동 오버라이드
- **거래처/공급처/품목 관리**: 엑셀 일괄 등록, 단가 이력·예약 변경
- **미수금/미지급 현황**: 거래처별 잔액, 기간별 미결제 전표
- **지급결의서**: 사용내역 등록, 영수증 첨부, 인쇄
- **할일/공지사항**: 할일 가져오기(매출/매입 등록에 연결), 담당자 배정
- **대시보드/캘린더**: 오늘의 업무, 카톡 복사용 텍스트(당일 매입-매출
  매칭), 재고위험 알림
- **환경설정**: 계정/권한 관리, 회사정보, 변경 이력(감사 로그, 관리자
  전용), 백업/복원(비파괴적 앱 내 기능 + 위 GitHub Actions 자동 백업)

## 프로젝트 구조

```
src/
  app/
    login/                로그인
    (dashboard)/           인증 필요 라우트 (사이드바 레이아웃)
      dashboard/            대시보드 + 캘린더
      sales/, purchases/    매출/매입
      inventory/            재고현황/실사/발주제안
      products/, customers/, suppliers/  마스터 데이터
      receivables/, payables/  미수금/미지급 현황
      reports/              월별 리포트, 지급결의서
      paper-calc/           모조지 계산기
      todos/, announcements/  할일/공지사항
      messenger/            사내 메신저
      settings/             계정/권한/회사정보/변경이력/백업복원
    api/                    엑셀 다운로드, 알림, 백업 등 API 라우트
  components/               화면 컴포넌트 (그리드/폼 다수)
  lib/                      순수 로직 (날짜, 재고, 이월, 감사 등) + 단위 테스트
  lib/supabase/             client/server/admin Supabase 클라이언트, proxy(인증 가드)
  types/database.types.ts   Supabase 테이블 타입
supabase/
  migrations/                스키마/RLS/RPC 함수 SQL (번호 순으로 순차 적용됨)
  config.toml                 Supabase CLI 설정 (max_rows=1000 등)
docs/
  db-backup-restore.md       DB 백업/복원 절차
  netlify-deploy.md          Netlify 이전 절차
  self-hosting-oracle.md     (참고용, 미사용) Oracle Cloud 셀프호스팅 대안
```

## 알아두면 유용한 함정들

이 코드베이스에서 실제로 버그를 냈던 패턴들입니다. 새 마이그레이션이나
쿼리를 작성할 때 참고하세요.

- **마이그레이션 함수 시그니처 변경**: Postgres의 `create or replace
  function`은 매개변수 목록(개수/타입)이 바뀌면 기존 함수를 "교체"하는
  게 아니라 새 오버로드를 만들어버립니다. 매개변수를 추가/변경할 땐 반드시
  `drop function if exists 기존함수(기존타입들)`을 먼저 실행한 뒤
  `create or replace function`을 써야 합니다.
- **PostgREST 1000행 제한**: `supabase/config.toml`의 `max_rows = 1000`
  때문에, `.range()`로 페이지네이션하지 않은 조회는 1000행을 넘으면
  에러 없이 조용히 잘립니다. 전체 데이터를 다 훑어야 하는 조회는
  `src/lib/fetch-all-rows.ts`의 `fetchAllRows()`를 씁니다.
- **본인/관리자 권한 패턴**: 매출·매입·할일·공지·지급결의서·수금/지급 등
  쓰기 작업은 "본인이 만든 것 또는 관리자만" 수정/삭제 가능하도록
  RLS + RPC 양쪽에서 확인합니다(`created_by = auth.uid() or is_admin()`).
  `.update()`/`.delete()`가 RLS에 막히면 Supabase는 **에러 없이 0건
  갱신**으로 조용히 끝나므로, 실제로 적용됐는지 `.select()`로 행 수를
  확인해야 합니다. 반대로 "누구 것이든 처리해야 하는" 정당한 예외(할일
  완료 처리 등)는 `security definer` RPC로 우회합니다.
- **KST 타임존**: 서버는 보통 UTC로 돕니다. "오늘"/"이번 달" 계산은
  `src/lib/kst-date.ts`를 거쳐야 한국 기준 자정~오전 9시 사이에 날짜가
  하루 밀리지 않습니다.
- **createAdminClient는 신중히**: `src/lib/supabase/admin.ts`의
  service-role 클라이언트는 RLS를 전부 우회합니다. 꼭 필요한 곳(관리자
  전용 기능)에만 쓰고, DB 권한(GRANT/REVOKE) 변경은 그 권한에 의존하는
  코드가 먼저 배포된 뒤에만 적용해야 합니다 — 순서가 바뀌면 로그인 등이
  즉시 장애 납니다(실제로 한 번 겪음).
