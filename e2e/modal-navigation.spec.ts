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
  // 모던 테마(넓은 화면): 행 클릭은 상세 패널 선택(매출·매입은 표 아래 패널, 그 외는 오른쪽 패널) — 상세 모달은 패널의 [상세 보기]로 연다. 클래식/좁은 화면: 행 클릭이 바로 상세 모달.
  const panel = page.locator("aside.erp-detail-side, .erp-detail-bottom").first();
  if (await panel.isVisible({ timeout: 3000 }).catch(() => false)) {
    // 진단: "상세 보기" 링크를 못 찾는 실패가 나면 패널 안에 무엇이 떠 있었는지 로그로 남긴다.
    const link = panel.getByRole("link", { name: "상세 보기" });
    if (!(await link.isVisible({ timeout: 15_000 }).catch(() => false))) {
      console.log(`PANEL-DIAG ${(await panel.innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 400)}`);
    }
    await link.click();
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
  // 모던의 모달은 화면 전체를 덮어 마우스로는 탭을 못 누른다 — 링크 이동(키보드·뒤로가기와 같은 경로)만 시험한다.
  await page.locator(".erp-titlebar-home").evaluate((el) => (el as HTMLElement).click());
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20000 });
  await noModal(page);
});

// 검색한 상태(주소에 ?q=…)에서 "신규"를 열어도 새 탭·전체 화면이 아니라 모달로 떠야 한다(전례: 이 경로는 시험이 없어 놓쳤다).
// 매출·매입 둘 다, 버튼 클릭·검색창에서 Ctrl+Enter 두 가지 경로를 본다. 데이터는 만들지 않는다(열기만).
for (const base of ["/sales", "/purchases"]) {
  test(`${base}: 검색한 상태에서 신규 버튼 → 모달(새 탭 아님)`, async ({ page, context }) => {
    await page.goto(`${base}?q=a`);
    await page.locator(`a[href="${base}/new"]`).first().click();
    await expect(page.locator(".erp-modal[role='dialog']")).toBeVisible({ timeout: 15000 });
    expect(context.pages()).toHaveLength(1);
    await expect(page).toHaveURL(new RegExp(`${base}/new`));
  });

  test(`${base}: 검색창에서 Enter로 검색한 뒤 신규 버튼 → 모달(새 탭 아님)`, async ({ page, context }) => {
    await page.goto(base);
    const search = page.locator('input[name="q"]').first();
    await search.fill("a");
    await search.press("Enter");
    await expect(page).toHaveURL(/q=a/, { timeout: 15000 });
    await page.locator(`a[href="${base}/new"]`).first().click();
    await expect(page.locator(".erp-modal[role='dialog']")).toBeVisible({ timeout: 15000 });
    expect(context.pages()).toHaveLength(1);
  });

  test(`${base}: 검색창에 커서가 있을 때 Ctrl+Enter(신규) → 모달(새 탭 아님)`, async ({ page, context }) => {
    await page.goto(`${base}?q=a`);
    const search = page.locator('input[name="q"]').first();
    await search.focus();
    await search.press("Control+Enter");
    await expect(page.locator(".erp-modal[role='dialog']")).toBeVisible({ timeout: 15000 });
    expect(context.pages()).toHaveLength(1);
  });
}
