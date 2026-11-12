import { expect, test } from "@playwright/test";

// 메인 화면 "오늘 리포트" 박스: 맨 위에 그려지고, 텍스트 복사 창과 전체 보기 창이 열린다.
test.describe("메인 화면 · 오늘 리포트 박스", () => {
  test("박스가 보이고 텍스트 복사 미리보기에 날짜 제목이 나온다", async ({ page }) => {
    await page.goto("/dashboard");
    const box = page.locator(".erp-daily-report");
    await expect(box).toBeVisible();
    await expect(box.getByText("금액 합계")).toBeVisible();
    await expect(box.getByText("품목 내역")).toBeVisible();
    await expect(box.getByText("재고 변동·부족")).toBeVisible();

    await box.getByRole("button", { name: "텍스트 복사" }).click();
    const preview = page.locator(".erp-daily-report-preview");
    await expect(preview).toContainText("오늘 리포트");
    await expect(preview).toContainText("[매출]");
    await expect(preview).toContainText("[매입]");
    await page.keyboard.press("Escape");
    await expect(preview).toBeHidden();
  });

  test("날짜 이동 버튼이 동작하고 오늘로 돌아올 수 있다", async ({ page }) => {
    await page.goto("/dashboard");
    const box = page.locator(".erp-daily-report");
    const title = box.locator(".erp-daily-report-title");
    await expect(title).toHaveText("오늘 리포트");
    const prev = box.getByRole("button", { name: /전날/ });
    if (await prev.isEnabled()) {
      await prev.click();
      await expect(title).toHaveText("일일 리포트");
      await box.getByRole("button", { name: "오늘" }).click();
      await expect(title).toHaveText("오늘 리포트");
    }
  });

  test("모바일 폭에서도 박스가 가로로 넘치지 않는다", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard");
    await expect(page.locator(".erp-daily-report")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
  });
});
