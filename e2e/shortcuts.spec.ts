import { expect, test } from "@playwright/test";

test.describe("단축키", () => {
  test("매출 목록에서 검색창에 커서가 있어도 F2로 신규 등록 화면이 열린다", async ({ page }) => {
    await page.goto("/sales");
    await page.locator('input[placeholder*="출고처명"]').click();
    await page.keyboard.press("F2");
    await expect(page).toHaveURL(/\/sales\/new/);
    // 클래식은 "매 출 전 표", 모던(새 전표 화면)은 "매출전표" — 글자 사이 공백 유무와 상관없이 찾는다.
    await expect(page.getByText(/매\s*출\s*전\s*표/).first()).toBeVisible();
  });
});
