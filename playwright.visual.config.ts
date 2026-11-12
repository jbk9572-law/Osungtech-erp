import { defineConfig } from "@playwright/test";

// 화면 비교 안전망 설정 — 같은 앱을 두 벌 띄운다: 기준(main에 배포된 버전, 3200번)과
// 검사 대상(이 브랜치, 3100번). 둘 다 같은 샌드박스 계정/같은 DB를 보므로 데이터가 같고,
// 코드 차이로 인한 화면 차이만 드러난다. BASE_DIR은 main을 빌드해 둔 폴더.
const BASE_DIR = process.env.BASE_DIR ?? "../base";
export default defineConfig({
  testDir: "./e2e-visual",
  workers: 1,
  fullyParallel: false,
  retries: 1,
  timeout: 120_000,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report-visual" }]],
  globalSetup: "./e2e-visual/global-setup.ts",
  use: { storageState: "e2e-visual/.auth/state.json" },
  webServer: [
    { command: "npm run start -- -p 3100", url: "http://localhost:3100/login", timeout: 180_000, reuseExistingServer: false },
    { command: "npm run start -- -p 3200", cwd: BASE_DIR, url: "http://localhost:3200/login", timeout: 180_000, reuseExistingServer: false },
  ],
});
