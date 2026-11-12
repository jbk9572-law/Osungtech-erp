import { expect, test } from "@playwright/test";
import { createSandboxApi, kstDate, type SandboxApi } from "./support/api";
import { cleanupTagged, createPurchase, createSale, uniqueTag } from "./support/orders";

// 매출/매입 목록에서 오늘(초록)·예약(회색, 미래 날짜)·이월(노란색) 행이 서로 다른
// 표시로 구분되는지 — 화면 클래스(day-today / day-future / row-carryover)로 확인한다.
test.describe("목록 행 구분", () => {
  let api: SandboxApi;
  const tag = uniqueTag("colors");

  test.beforeAll(async () => {
    api = await createSandboxApi();
    const today = kstDate(0);
    const future = kstDate(3);
    const lastMonth = new Date(Date.now() + 9 * 3600 * 1000);
    lastMonth.setUTCDate(0); // 지난달 말일
    await createSale(api, { date: today, memo: `${tag} 오늘` });
    await createSale(api, { date: future, memo: `${tag} 예약` });
    await createSale(api, { date: lastMonth.toISOString().slice(0, 10), memo: `${tag} 이월`, carryover: true });
    await createPurchase(api, { date: today, memo: `${tag} 오늘` });
    await createPurchase(api, { date: future, memo: `${tag} 예약` });
  });

  test.afterAll(async () => {
    await cleanupTagged(api, tag);
  });

  test("매출 목록: 오늘/예약/이월 행이 각각 구분된다", async ({ page }) => {
    await page.goto(`/sales?q=${encodeURIComponent(tag)}`);
    await expect(page.locator("tr.day-today")).toHaveCount(1);
    await expect(page.locator("tr.day-future")).toHaveCount(1);
    await expect(page.locator("tr.row-carryover")).toHaveCount(1);
    await expect(page.locator("tr.day-future").getByText("예약")).toBeVisible();
    await expect(page.locator("tr.row-carryover").getByText("이월")).toBeVisible();
  });

  test("매입 목록: 오늘/예약 행이 구분된다", async ({ page }) => {
    await page.goto(`/purchases?q=${encodeURIComponent(tag)}`);
    await expect(page.locator("tr.day-today")).toHaveCount(1);
    await expect(page.locator("tr.day-future")).toHaveCount(1);
  });
});
