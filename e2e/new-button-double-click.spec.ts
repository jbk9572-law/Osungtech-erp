import { expect, test, type Page } from "@playwright/test";

// 사용자 보고: 매입 목록에서 "F2 신규"를 마우스로 두 번 누르면 내용 영역이 통째로 비어버린다
// (탭은 "매입관리"인데 아무것도 안 그려짐). 첫 클릭의 이동이 끝나기 전에 두 번째 클릭이 들어가는
// 상황을 그대로 재현해, 끝난 뒤에 모달이든 전체 화면 폼이든 "무언가 입력 가능한 화면"이 떠 있는지 본다.
async function snapshot(page: Page) {
  return page.evaluate(() => ({
    url: location.pathname + location.search,
    modal: !!document.querySelector(".erp-modal"),
    mainTextLength: (document.querySelector("#erp-main-content") as HTMLElement | null)?.innerText.trim().length ?? -1,
    form: !!document.querySelector("form"),
    loading: !!document.querySelector("[data-erp-route-loading]"),
  }));
}

for (const [label, listPath, newPath] of [
  ["매입", "/purchases", "/purchases/new"],
  ["매출", "/sales", "/sales/new"],
] as const) {
  test.describe(`${label} 목록 신규 버튼 연타`, () => {
    for (const gapMs of [0, 60, 250]) {
      test(`두 번 클릭(간격 ${gapMs}ms) 후에도 등록 화면이 뜬다`, async ({ page }) => {
        await page.goto(listPath);
        const btn = page.locator(`a[href="${newPath}"].erp-btn`).first();
        await expect(btn).toBeVisible();
        await btn.click();
        if (gapMs) await page.waitForTimeout(gapMs);
        await btn.click({ force: true, noWaitAfter: true }).catch(() => {});
        await page.waitForTimeout(6000);
        const s = await snapshot(page);
        // 모달(.erp-modal) 또는 전체 화면 폼 중 하나는 반드시 있어야 하고, 로딩에 멈춰 있으면 안 된다.
        expect(s.loading, `로딩 화면에 멈춤: ${JSON.stringify(s)}`).toBe(false);
        expect(s.modal || (s.form && s.mainTextLength > 50), `빈 화면: ${JSON.stringify(s)}`).toBe(true);
      });
    }
  });
}
