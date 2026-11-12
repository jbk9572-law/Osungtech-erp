import { expect, test } from "@playwright/test";
import { createSandboxApi, type SandboxApi } from "./support/api";
import { cleanupTagged, uniqueTag } from "./support/orders";

// 매출/매입 "신규 등록 화면"(품목 입력 표, 거래처 검색, 저장)을 실제로 사람처럼 쓰는
// 테스트 — 두 폼은 코드의 절반가량이 복사본이라, 공용 부품으로 합치는 작업이 폼을
// 깨뜨리지 않는지 이 테스트가 지켜준다. 만든 거래는 표식(memo)으로 찾아 지운다.
test.describe("신규 등록 화면 (실제 입력)", () => {
  let api: SandboxApi;
  const tag = uniqueTag("form");

  test.beforeAll(async () => {
    api = await createSandboxApi(); // 테스트 전용 품목(E2E-FIXED)도 여기서 보장된다
  });
  test.afterEach(async () => {
    await cleanupTagged(api, tag);
  });

  test("매출 등록: 거래처·품목·수량을 입력하고 저장하면 매출이 생성된다", async ({ page }) => {
    await page.goto("/sales/new");
    await expect(page.getByText("매 출 전 표")).toBeVisible();
    // 품목 표 머리글의 열 너비 조절 손잡이(공용 ResizableTh)가 그려진다.
    await expect(page.locator(".erp-col-resize-handle").first()).toBeVisible();

    await page.locator("#sale-customer").fill("샌드박스");
    await page.locator("#sale-customer").press("Enter");

    const quick = page.getByPlaceholder("품목 검색 후 Enter로 바로 추가");
    await quick.fill("E2E-FIXED");
    await page.waitForTimeout(800);
    await quick.press("Enter");

    await page.locator('input[placeholder*="수량"]').first().fill("3");
    await page.locator('input[name="memo"]').fill(`${tag} 매출`);

    await page.getByRole("button", { name: /F7 매출 등록/ }).click();
    await expect(page).not.toHaveURL(/\/sales\/new/, { timeout: 60_000 });

    const r = await api.rest<{ id: string }[]>(`sales_orders?select=id&memo=like.*${encodeURIComponent(tag)}*`);
    expect(r.body.length).toBe(1);
  });

  test("매입 등록 화면이 열리고 품목 표 머리글이 그려진다", async ({ page }) => {
    await page.goto("/purchases/new");
    await expect(page.locator("#purchase-supplier")).toBeVisible();
    await expect(page.locator(".erp-col-resize-handle").first()).toBeVisible();
  });
});
