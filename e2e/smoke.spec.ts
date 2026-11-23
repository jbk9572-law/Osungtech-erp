import { expect, test } from "@playwright/test";

test.describe("기본 화면", () => {
  test("로그인 후 대시보드와 상단 리본이 보인다", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("button", { name: /빠른 검색/ })).toBeVisible();
  });

  test("매출관리 목록이 열린다", async ({ page }) => {
    await page.goto("/sales");
    await expect(page.getByRole("heading", { name: "매출관리" })).toBeVisible();
    await expect(page.locator("table.erp-grid").first()).toBeVisible();
  });

  test("매입관리 목록이 열린다", async ({ page }) => {
    await page.goto("/purchases");
    await expect(page.getByRole("heading", { name: "매입관리" })).toBeVisible();
  });
});

test.describe("로그인 화면 (로그인하지 않은 상태)", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("없는 계정으로 시도하면 어느 항목이 틀렸는지 알려주지 않는 하나의 문구가 나온다", async ({ page }) => {
    await page.goto("/login");
    await page.locator("#companyCode").fill("sandbox");
    await page.getByLabel("아이디", { exact: true }).fill("e2e-nobody@sandbox.elvonix.local");
    await page.getByLabel("비밀번호").fill("wrong-password-000");
    await page.getByRole("button", { name: "로그인" }).click();
    await expect(page.getByText("회사코드, 아이디, 비밀번호를 확인해주세요")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });
});
