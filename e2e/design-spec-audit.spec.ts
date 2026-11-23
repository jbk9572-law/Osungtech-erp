import { test } from "@playwright/test";

// 디자인 규칙표(design/SPEC.md)와 실제 앱 화면을 비교하는 "보고용" 점검.
// 핵심 화면을 열고 테마를 모던 2(grid-modern2)로 바꾼 뒤(테마는 data-theme 속성의 토큰 값만 바꾼다) 규칙표 수치와 다른 곳을 센다.
// 읽기만 하고 데이터를 만들지 않으며, 지금은 로그(SPEC ...)로만 남기고 실패시키지 않는다 — 어긋난 곳 목록을 만들기 위한 도구다.
const ROUTES = ["/sales", "/purchases", "/inventory", "/customers", "/receivables", "/suppliers", "/todos", "/settings/company"];

type Metric = { name: string; expect: string; total: number; bad: number; sample: string };

function measureInPage() {
  const rows: { name: string; expect: string; total: number; bad: number; sample: string }[] = [];
  const px = (v: string) => Math.round(parseFloat(v) * 10) / 10;
  const check = (name: string, expect: string, els: Element[], get: (e: Element) => number, ok: (n: number) => boolean) => {
    let bad = 0;
    let sample = "";
    for (const e of els) {
      const n = get(e);
      if (!ok(n)) {
        bad++;
        if (!sample) sample = `${(e as HTMLElement).className?.toString().slice(0, 40) || e.tagName} = ${n}`;
      }
    }
    rows.push({ name, expect, total: els.length, bad, sample });
  };
  const q = (s: string) => Array.from(document.querySelectorAll(s)).filter((e) => (e as HTMLElement).offsetParent !== null);
  const h = (e: Element) => px(getComputedStyle(e).height);
  const w = (e: Element) => px(getComputedStyle(e).width);
  const fs = (e: Element) => px(getComputedStyle(e).fontSize);
  const rad = (e: Element) => px(getComputedStyle(e).borderTopLeftRadius);

  check("좌측 메뉴 폭", "208", q(".erp-tree:not(.collapsed)"), w, (n) => n === 208);
  check("메뉴 항목 높이", "32", q(".erp-tree-item"), h, (n) => n === 32);
  check("메뉴 항목 글자", "13", q(".erp-tree-item"), fs, (n) => n === 13);
  check("버튼 높이(일반)", "28", q(".erp-btn:not(.erp-btn-sm):not(.erp-btn-xs)"), h, (n) => n === 28);
  check("버튼 높이(작은)", "24", q(".erp-btn-sm, .erp-btn-xs"), h, (n) => n === 24);
  check("입력칸 높이", "28", q("input.erp-input:not([type=checkbox]):not([type=radio]), select.erp-input"), h, (n) => n === 28);
  // 표 행은 1px 안팎(경계선)까지 허용한다 — 재고 막대처럼 칸 안에 부속 요소가 있는 행은 그 이상으로 커져 어긋남으로 센다.
  check("표 행 높이", "26±1", q(".erp-grid tbody td"), h, (n) => n >= 25 && n <= 27);
  check("표 머리 높이", "26", q(".erp-grid thead th"), h, (n) => n >= 22 && n <= 28);
  check("상세 패널 폭", "320", q(".erp-detail-side"), w, (n) => n === 320);
  check("카드 모서리", "8", q(".erp-settings-card, .erp-state"), rad, (n) => n === 8);
  check("페이지 본문 글자", "13", q(".erp-page"), fs, (n) => n === 13);
  return rows;
}

const all: Record<string, Metric[]> = {};

test.describe("규칙표 점검 · 모던 2", () => {
  test.use({ viewport: { width: 1360, height: 800 } });
  for (const route of ROUTES) {
    test(route, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState("domcontentloaded");
      test.skip(new URL(page.url()).pathname !== route, "다른 화면으로 이동함(기능 꺼짐·권한)");
      const ready = await page.locator("h1.erp-h1, table.erp-grid, form").first().waitFor({ state: "visible", timeout: 45_000 }).then(() => true, () => false);
      test.skip(!ready, "화면이 45초 안에 뜨지 않음");
      await page.evaluate(() => {
        document.documentElement.dataset.theme = "grid-modern2";
        document.querySelector(".erp")?.setAttribute("data-theme", "grid-modern2");
      });
      await page.waitForTimeout(500);
      // 첫 행이 있으면 눌러 상세 패널이 뜨게 한다(패널 폭 점검용)
      await page.locator("table.erp-grid tbody tr").first().click({ timeout: 2_000 }).catch(() => undefined);
      await page.waitForTimeout(400);
      const rows = await page.evaluate(measureInPage);
      all[route] = rows;
      for (const r of rows) console.log(`SPEC ${route} | ${r.name} | 기대 ${r.expect} | ${r.bad}/${r.total}곳 어긋남${r.sample ? ` | 예: ${r.sample}` : ""}`);
    });
  }
});

test.afterAll(async () => {
  const names = new Map<string, { bad: number; total: number }>();
  for (const rows of Object.values(all)) {
    for (const r of rows) {
      const c = names.get(r.name) ?? { bad: 0, total: 0 };
      c.bad += r.bad;
      c.total += r.total;
      names.set(r.name, c);
    }
  }
  for (const [name, c] of names) console.log(`SPEC-TOTAL ${name}: ${c.bad}/${c.total}곳 어긋남`);
});
