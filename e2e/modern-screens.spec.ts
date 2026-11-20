import { expect, test } from "@playwright/test";

// 화면 종류(A 표+패널 / B 필터 열 3분할)로 옮긴 화면들이 실제 앱에서 오류 없이 열리는지 본다.
// 기능을 꺼 둔 회사는 대시보드로 돌려보내므로(requireFeatureEnabled 등) 그때는 건너뛴다. 데이터를 만들거나 지우지 않는다(읽기만).
const SCREENS = [
  { name: "거래처관리", path: "/customers", table: true },
  { name: "공급처관리", path: "/suppliers", table: true },
  { name: "품목관리", path: "/products", table: true },
  { name: "견적서관리", path: "/quotes", table: true },
  { name: "구매요청", path: "/purchase-requests", table: true },
  { name: "구매 견적요청", path: "/purchase-quote-requests", table: true },
  { name: "지급결의", path: "/reports/payment-requests", table: true },
  { name: "하청업체관리", path: "/subcontractors", table: true },
  { name: "영업활동관리", path: "/sales-activities", table: true },
  { name: "할일관리", path: "/todos", table: false },
  { name: "전자결재 기안함", path: "/approvals", table: false },
  { name: "결재선 설정", path: "/approvals/lines", table: false },
  { name: "문서함", path: "/hr/documents", table: false },
  { name: "공문관리", path: "/official-documents", table: false },
  { name: "공지사항", path: "/announcements", table: false },
  { name: "메일함", path: "/mail", table: false },
  { name: "메신저", path: "/messenger", table: false },
];

for (const s of SCREENS) {
  test(`${s.name} 화면이 오류 없이 열린다`, async ({ page }) => {
    await page.goto(s.path);
    await page.waitForLoadState("domcontentloaded");
    if (!new URL(page.url()).pathname.startsWith(s.path)) test.skip(true, "이 회사는 이 기능을 꺼 두어 다른 화면으로 이동했다");
    // 제목줄이 보이고, 앱 오류 화면("일시적인 오류로…")이 아니다.
    const title = page.locator("h1.erp-h1").first();
    const started = Date.now();
    // (isVisible은 기다리지 않으므로 waitFor로 최대 70초 기다린다 — 느린 것과 멈춘 것을 가르려고 오래 기다린다.)
    const shown = await title.waitFor({ state: "visible", timeout: 70_000 }).then(() => true, () => false);
    test.info().annotations.push({ type: "열리는 데 걸린 시간(ms)", description: String(Date.now() - started) });
    if (!shown) {
      // 실패 원인을 로그에서 바로 볼 수 있게 화면에 보이는 글자 일부를 남긴다.
      const all = (await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ");
      const seen = `(전체 ${all.length}자, 끝 400자) ${all.slice(-400)}`; // 앞부분은 메뉴라 끝쪽에 본문(로딩/오류 문구)이 있다
      throw new Error(`제목줄(h1.erp-h1)이 70초 안에 안 떴다. url=${page.url()} 화면 글자: ${seen}`);
    }
    await expect(page.getByText("일시적인 오류로 화면을 불러오지 못했습니다")).toHaveCount(0);
    if (s.table) await expect(page.locator("table.erp-grid, .erp-grid-empty, .erp-row-card-list").first()).toBeVisible();
  });
}

test.describe("스프레드시트 동작(거래처 표)", () => {
  test("머리글을 눌러 정렬하고 열 설정으로 열을 숨길 수 있다", async ({ page }) => {
    await page.goto("/customers");
    const table = page.locator("table.erp-grid").first();
    test.skip(!(await table.isVisible({ timeout: 20_000 }).catch(() => false)), "표 화면이 아님(클래식 또는 좁은 화면)");
    const sortBtn = table.locator("thead th button.erp-th-btn").first();
    test.skip((await sortBtn.count()) === 0, "정렬 가능한 머리글이 없음(클래식)");
    await sortBtn.click();
    await expect(table.locator("thead th[aria-sort='ascending']")).toHaveCount(1);
    await sortBtn.click();
    await expect(table.locator("thead th[aria-sort='descending']")).toHaveCount(1);

    const headers = await table.locator("thead tr:last-child th").count();
    await page.locator("summary", { hasText: "열 설정" }).click();
    await page.locator(".erp-colmenu-item input").nth(2).uncheck();
    await expect(table.locator("thead tr:last-child th")).toHaveCount(headers - 1);
  });

  test("신규 버튼이 등록 모달을 연다", async ({ page }) => {
    await page.goto("/customers");
    const link = page.locator('a[href="/customers/new"]').first();
    test.skip((await link.count()) === 0, "신규 링크 없음");
    await link.click();
    await expect(page.locator(".erp-modal[role='dialog']")).toBeVisible({ timeout: 15_000 });
  });
});
