import { defineConfig, devices } from "@playwright/test";

// E2E(End-to-End) 테스트: vitest 단위 테스트가 계산 로직(계산기, 부가세 등)만
// 검증하는 것과 달리, 실제 브라우저를 띄워 화면을 클릭하고 입력하며 로그인
// 부터 저장까지 전체 흐름이 실제로 동작하는지 확인한다. Supabase 계정이
// 필요한 테스트는 PLAYWRIGHT_TEST_EMAIL/PLAYWRIGHT_TEST_PASSWORD 환경변수로
// 로그인 정보를 넘겨받는다 — 자세한 내용은 e2e/README.md 참고.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["html", { open: "never" }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // 로컬에서 baseURL을 따로 안 주면 npm run dev를 직접 띄워 테스트한다.
  // .env.local에 Supabase 접속정보가 없으면 모든 화면이 500 에러를
  // 반환하므로(src/lib/supabase/proxy.ts가 모든 요청에서 세션을 확인),
  // .env.local부터 채워야 서버가 정상적으로 뜬다.
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
