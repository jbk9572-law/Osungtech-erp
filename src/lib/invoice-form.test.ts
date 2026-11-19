import { describe, expect, it } from "vitest";
import { INVOICE_FORM_OPTIONS, invoiceFormParam, resolveInvoiceForm } from "./invoice-form";

describe("resolveInvoiceForm", () => {
  it("클래식·테마 없음은 기본이 B형", () => {
    expect(resolveInvoiceForm(undefined, null)).toBe("B");
    expect(resolveInvoiceForm(undefined, "classic-light")).toBe("B");
    expect(resolveInvoiceForm(undefined, "없는-테마")).toBe("B");
  });
  it("grid-modern은 기본이 새 서식(N)", () => {
    expect(resolveInvoiceForm(undefined, "grid-modern")).toBe("N");
  });
  it("주소에 직접 고른 값이 있으면 테마와 무관하게 그 값이 우선", () => {
    expect(resolveInvoiceForm("b", "grid-modern")).toBe("B");
    expect(resolveInvoiceForm("a", "grid-modern")).toBe("A");
    expect(resolveInvoiceForm("n", "classic-light")).toBe("N");
  });
  it("알 수 없는 값은 없는 것으로 보고 테마 기본을 쓴다", () => {
    expect(resolveInvoiceForm("x", "grid-modern")).toBe("N");
    expect(resolveInvoiceForm("", "classic-light")).toBe("B");
  });
  it("서식 → 주소값, 선택지 순서(새 서식이 맨 앞)", () => {
    expect(invoiceFormParam("N")).toBe("n");
    expect(invoiceFormParam("A")).toBe("a");
    expect(invoiceFormParam("B")).toBe("b");
    expect(INVOICE_FORM_OPTIONS.map((o) => o.value)).toEqual(["n", "b", "a"]);
  });
});
