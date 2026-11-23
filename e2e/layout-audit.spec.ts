import { test } from "@playwright/test";
import { THRESHOLDS, auditLayoutInPage, type LayoutFinding } from "./support/layout-audit";

// 입력 화면·목록 화면을 데스크톱·모바일 폭으로 열어 배치를 잰다(support/layout-audit.ts). 읽기만 하고 데이터를 만들지 않는다.
// 지금은 "보고용" — 발견 사항을 로그와 JSON 첨부로 남기고, 기준선(layout-audit-baseline.json)이 생기면 새로 늘어난 것만 실패로 본다.
const ROUTES = [
  "/customers/new", "/suppliers/new", "/products/new", "/subcontractors/new", "/sales-activities/new",
  "/quotes/new", "/purchase-requests/new", "/purchase-quote-requests/new", "/sales/new", "/purchases/new",
  "/todos/new", "/hr/documents/new", "/approvals/new", "/official-documents/new", "/approvals/lines/new",
  "/reports/payment-requests/new", "/inventory/transfers/new", "/calendar/new", "/production/new",
  "/settings/departments/new", "/settings/company", "/customers", "/suppliers", "/products", "/quotes",
  "/purchase-requests", "/purchase-quote-requests", "/sales-activities", "/subcontractors", "/receivables", "/payables",
  "/sales", "/purchases", "/inventory", "/todos",
];
const VIEWPORTS = [
  { name: "데스크톱", width: 1360, height: 800 },
  { name: "모바일", width: 390, height: 844 },
];

const all: Record<string, LayoutFinding[]> = {};

for (const vp of VIEWPORTS) {
  test.describe(`배치 점검 · ${vp.name}`, () => {
    // 모바일은 실제 휴대폰처럼 터치 기기(pointer: coarse)로 열어야 터치용 크기 규칙이 적용된다.
    test.use({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.name === "모바일", isMobile: vp.name === "모바일" });
    for (const route of ROUTES) {
      test(`${route}`, async ({ page }) => {
        await page.goto(route);
        await page.waitForLoadState("domcontentloaded");
        test.skip(new URL(page.url()).pathname !== route, "다른 화면으로 이동함(기능 꺼짐·권한)");
        const ready = await page.locator("h1.erp-h1, .erp-modal[role='dialog'], form").first().waitFor({ state: "visible", timeout: 45_000 }).then(() => true, () => false);
        test.skip(!ready, "화면이 45초 안에 뜨지 않음");
        await page.waitForTimeout(600); // 폰트·표 그리기가 끝나길 잠깐 기다린다
        const findings = await page.evaluate(auditLayoutInPage, THRESHOLDS);
        all[`${route} · ${vp.name}`] = findings;
        for (const f of findings) console.log(`AUDIT ${route} [${vp.name}] ${f.rule} — ${f.where} — ${f.detail}`);
        console.log(`AUDIT-SUMMARY ${route} [${vp.name}] ${findings.length}건`);
        await test.info().attach("layout-findings.json", { body: JSON.stringify(findings, null, 2), contentType: "application/json" });
      });
    }
  });
}

test.afterAll(async () => {
  const total = Object.values(all).reduce((n, f) => n + f.length, 0);
  console.log(`AUDIT-TOTAL ${total}건 / ${Object.keys(all).length}개 화면`);
});
