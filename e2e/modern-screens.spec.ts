import { expect, test } from "@playwright/test";

// 화면 종류(A 표+패널 / B 필터 열 3분할)로 옮긴 화면들이 실제 앱에서 오류 없이 열리는지 본다.
// 기능을 꺼 둔 회사는 대시보드로 돌려보내므로(requireFeatureEnabled 등) 그때는 건너뛴다. 데이터를 만들거나 지우지 않는다(읽기만).
const SCREENS = [
  { name: "거래처관리", path: "/customers", table: true },
  { name: "공급처관리", path: "/suppliers", table: true },
  { name: "미수금현황", path: "/receivables", table: true },
  { name: "미지급금현황", path: "/payables", table: true },
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

test.describe("거래처 도구 줄(시범)", () => {
  test("조회·신규·수정·삭제 버튼이 있고, 행을 고르면 수정이 켜진다", async ({ page }) => {
    await page.goto("/customers");
    const bar = page.getByRole("toolbar", { name: "목록 작업" });
    test.skip(!(await bar.isVisible({ timeout: 20_000 }).catch(() => false)), "도구 줄이 없음(클래식 또는 좁은 화면)");
    await expect(bar.getByRole("button", { name: /^조회/ })).toBeVisible();
    await expect(bar.getByRole("link", { name: /^신규/ })).toBeVisible();
    await expect(bar.getByRole("button", { name: /^수정/ })).toBeDisabled();
    await expect(bar.getByRole("button", { name: /^삭제/ })).toBeDisabled();
    const firstRow = page.locator("table.erp-grid tbody tr").first();
    test.skip(!(await firstRow.isVisible().catch(() => false)), "거래처가 없어 행 선택은 건너뜀");
    await firstRow.click();
    await expect(bar.getByRole("link", { name: /^수정/ })).toBeVisible();
  });
});

// 같은 도구 줄(공용 ListActionToolbar)을 쓰는 A형 목록 — 거래처 시범과 같은 모양이 나머지 목록에도 나오는지 본다.
for (const s of [
  { name: "공급처관리", path: "/suppliers" },
  { name: "품목관리", path: "/products" },
  { name: "견적서관리", path: "/quotes" },
  { name: "구매요청", path: "/purchase-requests" },
  { name: "구매 견적요청", path: "/purchase-quote-requests" },
  { name: "영업활동관리", path: "/sales-activities" },
  { name: "하청업체관리", path: "/subcontractors" },
  { name: "지급결의", path: "/reports/payment-requests" },
]) {
  test(`${s.name}에도 도구 줄(신규·수정·열 설정)이 있다`, async ({ page }) => {
    await page.goto(s.path);
    const bar = page.getByRole("toolbar", { name: "목록 작업" });
    test.skip(!(await bar.isVisible({ timeout: 30_000 }).catch(() => false)), "도구 줄이 없음(기능 꺼짐·클래식·좁은 화면)");
    await expect(bar.getByRole("link", { name: /F2|^신규|작성|등록/ }).first()).toBeVisible();
    await expect(bar.getByRole("button", { name: /^수정/ })).toBeDisabled();
    await expect(bar.getByText("열 설정")).toBeVisible();
  });
}

test.describe("모던 틀(상단바·하단 상태줄)", () => {
  test("메뉴 검색 버튼이 빠른 검색을 열고, 상태줄에 연결 상태가 보인다", async ({ page }) => {
    await page.goto("/customers");
    const searchBtn = page.locator(".erp-titlebar-search");
    test.skip(!(await searchBtn.isVisible({ timeout: 20_000 }).catch(() => false)), "모던 틀이 아님(클래식 또는 좁은 화면)");
    await expect(page.locator(".erp-statusbar-conn")).toHaveText("연결됨");
    await searchBtn.click();
    await expect(page.getByRole("textbox", { name: /메뉴 이름으로 검색/ }).or(page.getByPlaceholder("메뉴 이름으로 검색..."))).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("구매 견적요청 작성 폼", () => {
  test("공급처를 검색해 고를 수 있고, 조건이 안 채워지면 등록이 막히며 이유가 보인다", async ({ page }) => {
    await page.goto("/purchase-quote-requests/new");
    const picker = page.getByRole("group", { name: "견적을 받을 공급처" });
    test.skip(!(await picker.isVisible({ timeout: 30_000 }).catch(() => false)), "작성 화면이 열리지 않음(기능 꺼짐 등)");
    const submit = page.getByRole("button", { name: /견적요청 등록/ });
    await expect(submit).toBeDisabled();
    await expect(page.getByText("공급처를 1곳 이상 고르세요.")).toBeVisible();
    await expect(picker.getByText(/곳 선택됨/)).toContainText("0");
    const first = picker.getByRole("checkbox").first();
    test.skip(!(await first.isVisible().catch(() => false)), "공급처가 없어 선택은 건너뜀");
    await first.check();
    await expect(picker.getByText(/곳 선택됨/)).toContainText("1");
    // 공급처만 골라서는 아직 등록할 수 없다(품목 필요) — 데이터는 만들지 않는다.
    await expect(submit).toBeDisabled();
    await expect(page.getByText("품목을 1개 이상 입력하세요(수량 1 이상).")).toBeVisible();
  });
});
