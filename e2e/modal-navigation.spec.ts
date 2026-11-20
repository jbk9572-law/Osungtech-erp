import { expect, test } from "@playwright/test";

// 모달 열기·닫기·뒤로가기의 "어디로 돌아가는가"를 지키는 시나리오. 화면별로 하나씩 지적받아 고치던 문제들(닫으면 엉뚱한 모달이 다시 뜸,
// 수주 상세 ↔ 새 판매 등록이 서로를 열며 안 닫힘, 닫은 뒤 뒤로가기로 모달이 다시 열림)을 한 번에 확인한다.
// 데이터를 만들거나 바꾸지 않는다(열고 닫기만). 모달 위치 규칙은 src/lib/modal-origin.ts 참고.
const closeModal = (page: import("@playwright/test").Page) => page.locator(".erp-modal-window-close").click();
const noModal = (page: import("@playwright/test").Page) => expect(page.locator(".erp-modal")).toHaveCount(0, { timeout: 15000 });

test("메인 화면에서 '새 판매'를 열고 닫으면 메인 화면으로 돌아간다", async ({ page }) => {
  await page.goto("/dashboard");
  await page.locator('a[href="/sales/new"]').first().click();
  await expect(page.locator(".erp-modal[role='dialog']")).toBeVisible({ timeout: 15000 });
  await closeModal(page);
  await noModal(page);
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("닫은 뒤 브라우저 뒤로가기를 눌러도 닫은 모달이 다시 열리지 않는다", async ({ page }) => {
  await page.goto("/sales");
  await page.locator('a[href="/sales/new"]').first().click();
  await expect(page.locator(".erp-modal[role='dialog']")).toBeVisible({ timeout: 15000 });
  await closeModal(page);
  await noModal(page);
  await page.goBack();
  await page.waitForTimeout(1500);
  await expect(page.locator(".erp-modal")).toHaveCount(0);
});

test("상세 모달 → 닫기 → 목록으로 돌아가고 다른 모달이 다시 뜨지 않는다(상세 ↔ 새 등록 순환 방지)", async ({ page }) => {
  await page.goto("/sales");
  const row = page.locator("tbody tr.cursor-pointer").first();
  test.skip((await row.count()) === 0, "샌드박스에 매출 데이터가 없어 건너뜀");
  await row.click();
  // 모던 테마(넓은 화면): 행 클릭은 오른쪽 상세 패널 선택 — 상세 모달은 패널의 [상세 보기]로 연다. 클래식/좁은 화면: 행 클릭이 바로 상세 모달.
  const panel = page.locator("aside.erp-detail-side");
  if (await panel.isVisible({ timeout: 3000 }).catch(() => false)) {
    await panel.getByRole("link", { name: "상세 보기" }).click();
  }
  await expect(page.locator(".erp-modal[role='dialog']")).toBeVisible({ timeout: 15000 });
  await closeModal(page);
  await noModal(page);
  await page.waitForTimeout(1500);
  await expect(page.locator(".erp-modal")).toHaveCount(0);
  await expect(page).toHaveURL(/\/sales(\?|$)/);
});

test("모달이 열린 채로 상단 탭을 눌러 이동하면 모달이 남지 않는다", async ({ page }) => {
  await page.goto("/sales");
  await page.locator('a[href="/sales/new"]').first().click();
  await expect(page.locator(".erp-modal[role='dialog']")).toBeVisible({ timeout: 15000 });
  await page.locator(".erp-titlebar-home").click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20000 });
  await noModal(page);
});
