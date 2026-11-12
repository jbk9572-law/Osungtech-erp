import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DeliveryMethodCell, OrderDateCell, TaxTypeCell } from "./order-row-cells";
import { todayKstStr } from "@/lib/kst-date";

const wrap = (el: React.ReactElement) =>
  renderToStaticMarkup(createElement("table", null, createElement("tbody", null, createElement("tr", null, el))));

function addDays(dateStr: string, n: number) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

describe("OrderDateCell", () => {
  it("날짜가 없으면 '-'", () => {
    expect(wrap(createElement(OrderDateCell, { date: null, compact: false, isCarryover: false, style: undefined }))).toContain(">-</td>");
  });
  it("이월 건에는 '이월' 뱃지가 붙는다", () => {
    expect(wrap(createElement(OrderDateCell, { date: "2025-01-05", compact: false, isCarryover: true, style: undefined }))).toContain("이월");
  });
  it("미래 날짜는 '예약' 뱃지가 붙는다", () => {
    const future = addDays(todayKstStr(), 3);
    expect(wrap(createElement(OrderDateCell, { date: future, compact: false, isCarryover: false, style: undefined }))).toContain("예약");
  });
  it("지난 날짜에는 예약 뱃지가 없다", () => {
    expect(wrap(createElement(OrderDateCell, { date: "2025-01-05", compact: false, isCarryover: false, style: undefined }))).not.toContain("예약");
  });
});

describe("TaxTypeCell", () => {
  it("과세/영세/그 외를 서로 다른 색 뱃지로 그린다", () => {
    const info = wrap(createElement(TaxTypeCell, { taxType: "과세", style: undefined }));
    const warn = wrap(createElement(TaxTypeCell, { taxType: "영세", style: undefined }));
    const muted = wrap(createElement(TaxTypeCell, { taxType: "면세", style: undefined }));
    expect(info).toContain("erp-badge-info");
    expect(warn).toContain("erp-badge-warning");
    expect(muted).toContain("erp-badge-muted");
  });
  it("값이 없으면 '-'", () => {
    expect(wrap(createElement(TaxTypeCell, { taxType: null, style: undefined }))).toContain(">-</td>");
  });
});

describe("DeliveryMethodCell", () => {
  it("값이 있으면 뱃지, 없으면 흐린 '-'", () => {
    expect(wrap(createElement(DeliveryMethodCell, { deliveryMethod: "택배", style: undefined }))).toContain("택배");
    expect(wrap(createElement(DeliveryMethodCell, { deliveryMethod: null, style: undefined }))).toContain("erp-u-muted");
  });
});
