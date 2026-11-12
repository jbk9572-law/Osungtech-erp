import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PaperCalcSizeLineRows, PendingPaperCalcRow } from "./order-form-paper-calc-rows";

// 품목 표 머리글의 칸 수와 이 임시 줄들의 칸 수가 어긋나면 표가 틀어진다.
// 매출 폼 = 11열(품목·규격·관리번호·단위·수량·단가·공급가액·세액·합계·비고·버튼),
// 매입 폼의 "매출도 같이 등록" = 입고/출고 수량·매입/매출 단가가 갈라져 13열.
// colSpan이 있는 칸은 그 폭만큼 열을 차지하므로 열 수로 센다.
function countColumns(html: string) {
  let total = 0;
  for (const m of html.matchAll(/<td([^>]*)>/g)) {
    const span = /colSpan="(\d+)"/.exec(m[1]);
    total += span ? Number(span[1]) : 1;
  }
  return total;
}

const base = {
  tg0Product: { name: "모조지", unit: "연" },
  quantity: 3,
  onQuantityChange: () => {},
  unitAmount: 1000,
  amount: 3000,
  autoSheet: 3.2,
  isOverridden: false,
  onCancel: () => {},
};

describe("PendingPaperCalcRow", () => {
  it("기본(매출 폼)은 11열을 채운다", () => {
    const html = renderToStaticMarkup(createElement("table", null, createElement("tbody", null, createElement(PendingPaperCalcRow, base))));
    expect(countColumns(html)).toBe(11);
  });
  it("매입 폼의 매출 같이 등록 모드는 대시 칸 2개가 늘어난다", () => {
    const html = renderToStaticMarkup(
      createElement("table", null, createElement("tbody", null, createElement(PendingPaperCalcRow, { ...base, dashAfterQuantity: true, dashAfterUnit: true }))),
    );
    expect(countColumns(html)).toBe(13);
  });
  it("수동으로 고친 수량이면 자동값을 같이 보여준다", () => {
    const html = renderToStaticMarkup(createElement("table", null, createElement("tbody", null, createElement(PendingPaperCalcRow, { ...base, isOverridden: true }))));
    expect(html).toContain("자동값 3.2 → 수동 입력");
  });
  it("TG0 품목이 없으면 경고 문구를 보여준다", () => {
    const html = renderToStaticMarkup(createElement("table", null, createElement("tbody", null, createElement(PendingPaperCalcRow, { ...base, tg0Product: undefined }))));
    expect(html).toContain("자동 반영되지 않습니다");
  });
});

describe("PaperCalcSizeLineRows", () => {
  it("줄마다 한 행, 열 수는 임시 줄과 같다", () => {
    const html = renderToStaticMarkup(createElement("table", null, createElement("tbody", null, createElement(PaperCalcSizeLineRows, { lines: ["a", "b"] }))));
    expect((html.match(/<tr/g) ?? []).length).toBe(2);
    expect(countColumns(html) / 2).toBe(11);
  });
  it("매입 같이 등록 모드는 열이 2개 늘어난다", () => {
    const html = renderToStaticMarkup(
      createElement("table", null, createElement("tbody", null, createElement(PaperCalcSizeLineRows, { lines: ["a"], dashAfterQuantity: true, dashAfterUnit: true }))),
    );
    expect(countColumns(html)).toBe(13);
  });
  it("줄이 없으면 아무것도 그리지 않는다", () => {
    const html = renderToStaticMarkup(createElement("table", null, createElement("tbody", null, createElement(PaperCalcSizeLineRows, { lines: [] }))));
    expect(html).toBe("<table><tbody></tbody></table>");
  });
});
