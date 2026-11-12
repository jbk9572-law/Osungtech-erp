import { defineConfig } from "@playwright/test";

// 샌드박스 테넌트(운영 DB 안의 테스트 전용 회사)로 실제 앱을 띄워 확인하는 e2e 설정.
// 계정 정보는 환경변수(E2E_EMAIL/E2E_PASSWORD/E2E_COMPANY)로만 받는다 — CI에서는
// GitHub 비밀값(SANDBOX_*)에서 온다. 회사 분리(RLS) 때문에 이 계정으로는 샌드박스
// 데이터만 만질 수 있고, 테스트가 만든 거래는 끝날 때 스스로 지운다.
const PORT = 3100;
export default defineConfig({
  testDir: "./e2e",
  // 같은 계정/같은 테넌트를 동시에 만지면 서로 데이터를 건드려 불안정해진다.
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  globalSetup: "./e2e/support/global-setup.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    storageState: "e2e/.auth/state.json",
    trace: "off",
    video: "off",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: process.env.CI ? `npm run start -- -p ${PORT}` : `npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
