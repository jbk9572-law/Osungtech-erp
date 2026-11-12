import { expect, test, type Browser } from "@playwright/test";
import { compareScreenshots } from "../src/lib/visual-compare";

// 같은 화면을 기준(main, 3200)과 수정본(3100)으로 각각 찍어 픽셀을 비교한다.
// 스타일/폼 합치기 같은 "겉모습은 그대로여야 하는 작업"이 화면을 바꾸지 않았는지 기계가 본다.
// 데이터가 자주 바뀌는 화면(대시보드 등)은 넣지 않고, 샌드박스에서 안정적인 화면만 쓴다.
const BASE = "http://localhost:3200";
const NEXT = "http://localhost:3100";
const MAX_DIFF_RATIO = 0.001; // 전체 픽셀의 0.1%까지는 글자 안티앨리어싱 오차로 본다

const PAGES = [
  { name: "매출 신규 등록", path: "/sales/new" },
  { name: "매입 신규 등록", path: "/purchases/new" },
  { name: "매출 목록(빈 결과)", path: "/sales?q=__no_such_order__" },
  { name: "매입 목록(빈 결과)", path: "/purchases?q=__no_such_order__" },
  { name: "거래처 목록", path: "/customers" },
  { name: "품목 목록", path: "/products" },
  { name: "공급처 목록", path: "/suppliers" },
  { name: "재고 현황", path: "/inventory" },
];
const VIEWPORTS = [
  { name: "데스크톱", width: 1400, height: 900 },
  { name: "모바일", width: 390, height: 844 },
];

const FREEZE = `*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}`;

async function shot(browser: Browser, base: string, path: string, vp: { width: number; height: number }) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, storageState: "e2e-visual/.auth/state.json" });
  const page = await ctx.newPage();
  page.setDefaultTimeout(90_000);
  await page.goto(base + path, { waitUntil: "load" });
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await page.addStyleTag({ content: FREEZE });
  await page.waitForTimeout(2500);
  const png = await page.screenshot({ fullPage: true });
  await ctx.close();
  return png;
}

for (const vp of VIEWPORTS) {
  for (const p of PAGES) {
    test(`${p.name} — ${vp.name}`, async ({ browser }, testInfo) => {
      const before = await shot(browser, BASE, p.path, vp);
      const after = await shot(browser, NEXT, p.path, vp);
      const diff = compareScreenshots(before, after);
      if (diff.ratio > MAX_DIFF_RATIO) {
        await testInfo.attach("기준(main)", { body: before, contentType: "image/png" });
        await testInfo.attach("수정본", { body: after, contentType: "image/png" });
        if (diff.diffPng) await testInfo.attach("차이(빨간색)", { body: diff.diffPng, contentType: "image/png" });
      }
      expect(
        diff.ratio,
        diff.sameSize
          ? `화면이 ${(diff.ratio * 100).toFixed(2)}% 달라졌습니다 (${diff.diffPixels}픽셀)`
          : "화면 크기(레이아웃 높이)가 달라졌습니다",
      ).toBeLessThanOrEqual(MAX_DIFF_RATIO);
    });
  }
}
