import { describe, expect, it } from "vitest";
import {
  A_HEADER,
  A_ITEM_COLS,
  A_LEFT,
  A_RIGHT,
  A_SUMMARY,
  aColWidthsPct,
  aSpan,
} from "./InvoiceGridA";
import { computeInvoiceTotals } from "./InvoiceTotals";

describe("A형 격자", () => {
  it("칸 너비 합계는 100%", () => {
    const sum = aColWidthsPct().reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(100, 6);
  });

  // 각 줄은 표 전체 폭(44.4~559.7)을 빈틈·겹침 없이 채워야 한다 — 어긋나면 표가 틀어진다.
  const total = aSpan(44.4, 559.7);
  const spans = (ranges: [number, number][]) => ranges.reduce((s, r) => s + aSpan(r[0], r[1]), 0);

  it("사업자번호/상호/주소/업태 줄이 전체 폭을 정확히 채운다", () => {
    const r = (s: typeof A_LEFT) => [s.r1.label, s.r1.number, s.r1.sub, s.r1.blank];
    expect(spans([...r(A_LEFT), ...r(A_RIGHT)])).toBe(total);
    const r2 = (s: typeof A_LEFT) => [s.r2.label, s.r2.name, s.r2.repLabel, s.r2.rep];
    expect(spans([...r2(A_LEFT), ...r2(A_RIGHT)])).toBe(total);
    const r3 = (s: typeof A_LEFT) => [s.r3.label, s.r3.value];
    expect(spans([...r3(A_LEFT), ...r3(A_RIGHT)])).toBe(total);
    const r4 = (s: typeof A_LEFT) => [s.r4.l1, s.r4.v1, s.r4.l2, s.r4.v2];
    expect(spans([...r4(A_LEFT), ...r4(A_RIGHT)])).toBe(total);
  });

  it("머리/품목/합계 줄도 전체 폭을 정확히 채운다", () => {
    expect(
      spans([A_HEADER.title, A_HEADER.copyLabel, A_HEADER.dateLabel, A_HEADER.date, A_HEADER.noLabel, A_HEADER.no, A_HEADER.page]),
    ).toBe(total);
    expect(spans(A_ITEM_COLS)).toBe(total);
    expect(spans([A_SUMMARY.label, A_SUMMARY.value, A_SUMMARY.balLabel, A_SUMMARY.balValue])).toBe(total);
  });

  it("격자에 없는 좌표는 에러", () => {
    expect(() => aSpan(44.4, 123.4)).toThrow();
  });
});

describe("computeInvoiceTotals", () => {
  const items = [
    { id: "1", monthDay: "", productLabel: "", unit: "", quantity: 10, unitPrice: 100, supplyAmount: 1000, taxAmount: 100 },
    { id: "2", monthDay: "", productLabel: "", unit: "", quantity: 5, unitPrice: 200, supplyAmount: 1000, taxAmount: 100 },
  ];
  it("합계와 전잔금(총잔금 − 이번 거래)을 계산한다", () => {
    const t = computeInvoiceTotals(items, 5200);
    expect(t.totalQuantity).toBe(15);
    expect(t.grandTotal).toBe(2200);
    expect(t.priorBalance).toBe(3000);
  });
  it("잔액을 안 주면 전잔금도 없다", () => {
    expect(computeInvoiceTotals(items).priorBalance).toBeUndefined();
  });
});
