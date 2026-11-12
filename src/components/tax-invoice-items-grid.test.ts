import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TaxInvoiceItemsGrid } from "./tax-invoice-items-grid";
import { blankTaxInvoiceRow } from "@/lib/tax-invoice-rows";

const render = (rows = [blankTaxInvoiceRow(0, "2026-11-12")], extra: Record<string, unknown> = {}) =>
  renderToStaticMarkup(
    createElement(TaxInvoiceItemsGrid, { rows, onUpdate: () => {}, onRemove: () => {}, onAdd: () => {}, totalSupply: 1000, totalTax: 100, ...extra }),
  );

describe("TaxInvoiceItemsGrid", () => {
  it("모바일에서도 안 찌그러지게 표를 고정폭으로 그린다", () => {
    expect(render()).toContain("table-layout:fixed");
    expect(render()).toContain("min-width:970px");
  });
  it("줄마다 한 행, 합계와 '품목 추가 (n/16)'을 보여준다", () => {
    const html = render([blankTaxInvoiceRow(0, "d"), blankTaxInvoiceRow(1, "d")]);
    expect((html.match(/<tr/g) ?? []).length).toBe(1 + 2 + 1); // 머리글 + 줄 2개 + 합계
    expect(html).toContain("+ 품목 추가 (2/16)");
    expect(html).toContain("1,000");
  });
  it("16줄이면 추가 버튼이 잠긴다", () => {
    const rows = Array.from({ length: 16 }, (_, i) => blankTaxInvoiceRow(i, "d"));
    expect(render(rows)).toContain('disabled=""');
    expect(render()).not.toContain('disabled=""');
  });
});
