import { describe, expect, it } from "vitest";
import { resolveInvoiceForm } from "./invoice-form";

describe("resolveInvoiceForm", () => {
  it("클래식·테마 없음은 기본이 B형", () => {
    expect(resolveInvoiceForm(undefined, null)).toBe("B");
    expect(resolveInvoiceForm(undefined, "classic-light")).toBe("B");
    expect(resolveInvoiceForm(undefined, "없는-테마")).toBe("B");
  });
  it("grid-modern은 기본이 A형", () => {
    expect(resolveInvoiceForm(undefined, "grid-modern")).toBe("A");
  });
  it("주소에 직접 고른 값이 있으면 테마와 무관하게 그 값이 우선", () => {
    expect(resolveInvoiceForm("b", "grid-modern")).toBe("B");
    expect(resolveInvoiceForm("a", "classic-light")).toBe("A");
  });
  it("알 수 없는 값은 없는 것으로 보고 테마 기본을 쓴다", () => {
    expect(resolveInvoiceForm("x", "grid-modern")).toBe("A");
    expect(resolveInvoiceForm("", "classic-light")).toBe("B");
  });
});
