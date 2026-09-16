# E2E(엔드투엔드) 테스트

## 이게 뭔가요?

`npm test`(vitest)로 돌아가는 기존 테스트는 **계산 로직만** 확인한다 —
예를 들어 "부가세 계산이 맞는지", "모조지 재단 조합이 맞는지" 같은
순수 함수 결과값 검증. 화면을 실제로 열어보지는 않는다.

E2E 테스트는 진짜 브라우저(Chromium)를 띄워서 사람이 하듯 화면을
클릭하고, 입력하고, 페이지가 이동하는지까지 확인한다. 예:
"로그인 화면에 아이디/비밀번호 입력창이 보이는가", "틀린 비밀번호를
넣으면 에러 메시지가 뜨는가", "로그인하면 대시보드로 넘어가는가".
버튼 위치가 바뀌었다거나, 화면이 아예 안 뜨는 것 같은 문제는 계산
로직 테스트로는 못 잡고 이 테스트로만 잡을 수 있다.

## 실행 방법

```bash
npm run test:e2e        # 터미널에서 전체 실행
npm run test:e2e:ui     # 브라우저 창을 직접 보면서 실행 (디버깅용)
```

처음 실행 전에 Playwright가 쓸 브라우저를 한 번 받아야 한다:

```bash
npx playwright install chromium
```

## 계정 없이 되는 테스트 / 계정이 있어야 되는 테스트

- **`login.spec.ts`** — 로그인 계정 없이 바로 실행된다. 로그인 화면이
  뜨는지, 세션 없이 보호된 화면(`/dashboard`)에 들어가면 `/login`으로
  튕기는지, 틀린 계정으로 로그인하면 에러가 뜨는지 확인한다.
- **`authenticated.spec.ts`** — 실제 로그인이 필요해서, 테스트 전용
  계정 정보를 환경변수로 넘겨줘야 한다:

  ```bash
  PLAYWRIGHT_TEST_EMAIL="test@example.com" PLAYWRIGHT_TEST_PASSWORD="..." npm run test:e2e
  ```

  이 값이 없으면 해당 테스트는 실패가 아니라 "건너뜀(skipped)"으로
  표시된다 — 계정을 안 만들어 놨어도 다른 테스트는 정상적으로 돈다.
  실제 운영 계정이 아니라, 테스트용으로 따로 만든 계정을 쓰길 권한다
  (테스트가 반복 로그인하면서 세션/로그를 계속 남긴다).

  이 앱의 로그인은 이메일이 아니라 **아이디**로 하므로(예: `e2etest`),
  로그인 서버 액션이 내부적으로 관리자 클라이언트(`SUPABASE_SERVICE_ROLE_KEY`
  필요)로 아이디→이메일을 조회한다 — 이 키가 없으면 진짜 계정 정보를
  넣어도 로그인이 "일시적인 오류"로 실패하고 `/login`에 그대로 남는다.
  그래서 `PLAYWRIGHT_TEST_EMAIL`/`PLAYWRIGHT_TEST_PASSWORD`와 함께
  `SUPABASE_SERVICE_ROLE_KEY`(`.env.local`의 값과 동일)도 넘겨야 한다.

## 실행 전에 꼭 필요한 것

이 저장소에는 `.env.local`이 없다(Supabase 접속 정보는 비밀이라 커밋
하지 않음). `.env.local`이 없으면 로그인 화면을 포함한 **모든 화면이
500 에러**를 낸다 — `src/lib/supabase/proxy.ts`가 모든 요청마다 세션을
확인하려고 Supabase에 접속을 시도하기 때문이다. 그래서 E2E 테스트를
실제로 돌리려면 먼저 `.env.local.example`을 복사해 `.env.local`을
만들고 실제 Supabase 프로젝트 정보를 채워야 한다.

`playwright.config.ts`는 기본적으로 `npm run dev`를 직접 띄워서
테스트한다. 이미 띄워 놓은 서버(다른 주소)를 대상으로 테스트하려면
`PLAYWRIGHT_BASE_URL` 환경변수로 그 주소를 넘기면 된다.

## CI에서 자동으로 돈다

`.github/workflows/ci.yml`이 `main`/`claude/**` 브랜치에 push하거나
`main`으로 PR을 올릴 때마다 tsc/lint/유닛테스트/build를 먼저 돌리고
(quality 잡), 그게 통과하면 이 e2e 테스트도 이어서 돈다(e2e 잡).
`login.spec.ts`는 계정 없이 그대로 돌고, `authenticated.spec.ts`는
저장소에 `PLAYWRIGHT_TEST_EMAIL`/`PLAYWRIGHT_TEST_PASSWORD` **그리고**
`SUPABASE_SERVICE_ROLE_KEY` 시크릿을 모두 등록해둔 경우에만 돈다
(Settings > Secrets and variables > Actions) — 안 넣어도 CI가 실패하지
않고 그 테스트만 건너뛴다. 다만 앞의 두 개만 넣고 이 키를 빠뜨리면
"건너뜀"이 아니라 로그인 자체가 계속 실패한다(위 참고). 실패하면 Actions
탭에서 해당 실행의 Artifacts에 올라간 `playwright-report`를 내려받아
`npx playwright show-report`로 열어보면 어디서 왜 실패했는지(스크린샷
포함) 볼 수 있다.
