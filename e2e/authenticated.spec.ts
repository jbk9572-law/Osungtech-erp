import { test, expect } from "@playwright/test";

// 실제 로그인이 필요한 테스트 — Supabase 프로젝트에 미리 만들어 둔 테스트
// 전용 계정 정보를 PLAYWRIGHT_TEST_EMAIL / PLAYWRIGHT_TEST_PASSWORD 환경
// 변수로 받는다. 값이 없으면 (예: 이 계정 정보가 없는 환경) 조용히
// 건너뛴다 — 자세한 내용은 e2e/README.md 참고.
const EMAIL = process.env.PLAYWRIGHT_TEST_EMAIL;
const PASSWORD = process.env.PLAYWRIGHT_TEST_PASSWORD;

test.describe("로그인 후 화면", () => {
  test.skip(
    !EMAIL || !PASSWORD,
    "PLAYWRIGHT_TEST_EMAIL/PLAYWRIGHT_TEST_PASSWORD가 없어 건너뜀 (e2e/README.md 참고)"
  );

  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("아이디").fill(EMAIL!);
    await page.getByLabel("비밀번호").fill(PASSWORD!);
    await page.getByRole("button", { name: "로그인" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("대시보드에 리본 메뉴가 보인다", async ({ page }) => {
    await expect(page.getByRole("button", { name: /빠른 검색/ })).toBeVisible();
  });

  test("매출관리 목록 화면으로 이동할 수 있다", async ({ page }) => {
    await page.goto("/sales");
    await expect(page.getByRole("heading", { name: "매출관리" })).toBeVisible();
  });
});
