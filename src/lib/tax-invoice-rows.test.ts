import { describe, expect, it } from "vitest";
import {
  MAX_TAX_INVOICE_ROWS,
  applyTaxInvoiceRowPatch,
  blankTaxInvoiceRow,
  seedTaxInvoiceRows,
  summarizeTaxInvoiceRows,
} from "./tax-invoice-rows";

describe("seedTaxInvoiceRows", () => {
  it("품목이 없으면 빈 줄 하나", () => {
    expect(seedTaxInvoiceRows([], "2026-11-12")).toEqual([blankTaxInvoiceRow(0, "2026-11-12")]);
  });
  it("원본 품목으로 공급가액·세액을 계산해 깐다", () => {
    const [row] = seedTaxInvoiceRows([{ itemName: "A", spec: "s", quantity: 3, unitPrice: 1000 }], "2026-11-12");
    expect(row).toMatchObject({ key: 0, quantity: 3, supplyAmount: 3000, taxAmount: 300, lineDate: "2026-11-12" });
  });
  it("수정세금계산서는 수량을 음수로 뒤집는다", () => {
    const [row] = seedTaxInvoiceRows([{ itemName: "A", spec: "", quantity: 3, unitPrice: 1000 }], "2026-11-12", { negateQuantity: true });
    expect(row).toMatchObject({ quantity: -3, supplyAmount: -3000, taxAmount: -300 });
  });
  it(`최대 ${MAX_TAX_INVOICE_ROWS}줄까지만 깐다`, () => {
    const items = Array.from({ length: 30 }, (_, i) => ({ itemName: `p${i}`, spec: "", quantity: 1, unitPrice: 10 }));
    expect(seedTaxInvoiceRows(items, "2026-11-12")).toHaveLength(MAX_TAX_INVOICE_ROWS);
  });
});

describe("applyTaxInvoiceRowPatch", () => {
  const base = { ...blankTaxInvoiceRow(1, "2026-11-12"), quantity: 2, unitPrice: 500, supplyAmount: 1000, taxAmount: 100 };
  it("수량이 바뀌면 공급가액과 세액을 다시 계산한다", () => {
    expect(applyTaxInvoiceRowPatch(base, { quantity: 4 })).toMatchObject({ supplyAmount: 2000, taxAmount: 200 });
  });
  it("단가가 바뀌면 다시 계산한다", () => {
    expect(applyTaxInvoiceRowPatch(base, { unitPrice: 1000 })).toMatchObject({ supplyAmount: 2000, taxAmount: 200 });
  });
  it("공급가액을 직접 고치면 그 값을 그대로 둔다", () => {
    expect(applyTaxInvoiceRowPatch(base, { supplyAmount: 777 })).toMatchObject({ supplyAmount: 777, taxAmount: 100 });
  });
  it("원래 줄 객체는 바꾸지 않는다", () => {
    applyTaxInvoiceRowPatch(base, { quantity: 9 });
    expect(base.quantity).toBe(2);
  });
});

describe("summarizeTaxInvoiceRows", () => {
  it("품목명이 빈 줄은 합계와 JSON에서 뺀다", () => {
    const rows = [
      { ...blankTaxInvoiceRow(0, "d"), itemName: "A", quantity: 1, unitPrice: 100, supplyAmount: 100, taxAmount: 10 },
      { ...blankTaxInvoiceRow(1, "d"), itemName: "  ", supplyAmount: 999, taxAmount: 99 },
    ];
    const s = summarizeTaxInvoiceRows(rows);
    expect(s.validRows).toHaveLength(1);
    expect(s.totalSupply).toBe(100);
    expect(s.totalTax).toBe(10);
    expect(s.totalAmount).toBe(110);
    expect(JSON.parse(s.itemsJson)).toEqual([
      { lineDate: "d", itemName: "A", spec: null, quantity: 1, unitPrice: 100, supplyAmount: 100, taxAmount: 10, remark: null },
    ]);
  });
  it("줄이 없으면 합계 0", () => {
    expect(summarizeTaxInvoiceRows([])).toMatchObject({ totalSupply: 0, totalTax: 0, totalAmount: 0, itemsJson: "[]" });
  });
});
