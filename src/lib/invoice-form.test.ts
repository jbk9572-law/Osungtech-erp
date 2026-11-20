import { describe, expect, it } from "vitest";
import { availableInvoiceForms, invoiceFormOptionGroup, invoiceFormParam, resolveInvoiceForm } from "./invoice-form";

const OSUNG_CLASSIC = { theme: "classic-light", slug: "osungtech" };
const OSUNG_MODERN = { theme: "grid-modern", slug: "osungtech" };
const OTHER_MODERN = { theme: "grid-modern", slug: "acme" };
const OTHER_CLASSIC = { theme: "classic-light", slug: "acme" };

describe("availableInvoiceForms — 회사마다 보이는 서식이 다르다", () => {
  it("엘보닉스 N형은 모던 그리드 회사에만", () => {
    expect(availableInvoiceForms(OTHER_MODERN)).toEqual(["N", "NB"]);
    expect(availableInvoiceForms(OSUNG_CLASSIC)).not.toContain("N");
  });
  it("엔택스 A·B형은 오성테크에만(다른 회사에는 안 보임)", () => {
    expect(availableInvoiceForms(OSUNG_CLASSIC)).toEqual(["B", "A"]);
    expect(availableInvoiceForms(OSUNG_MODERN)).toEqual(["N", "NB", "B", "A"]);
    expect(availableInvoiceForms(OTHER_MODERN)).not.toContain("A");
    expect(availableInvoiceForms(OTHER_MODERN)).not.toContain("B");
  });
  it("둘 다 아니면 인쇄가 막히지 않게 N형 하나", () => {
    expect(availableInvoiceForms(OTHER_CLASSIC)).toEqual(["N"]);
    expect(availableInvoiceForms({ theme: null, slug: null })).toEqual(["N"]);
  });
});

describe("resolveInvoiceForm", () => {
  it("오성테크 클래식은 기본이 B형", () => {
    expect(resolveInvoiceForm(undefined, OSUNG_CLASSIC)).toBe("B");
  });
  it("모던 그리드는 기본이 N형", () => {
    expect(resolveInvoiceForm(undefined, OSUNG_MODERN)).toBe("N");
    expect(resolveInvoiceForm(undefined, OTHER_MODERN)).toBe("N");
  });
  it("직접 고른 값은 그 회사가 쓸 수 있을 때만 따른다", () => {
    expect(resolveInvoiceForm("a", OSUNG_MODERN)).toBe("A");
    expect(resolveInvoiceForm("n", OSUNG_MODERN)).toBe("N");
    expect(resolveInvoiceForm("nb", OTHER_MODERN)).toBe("NB");
    expect(resolveInvoiceForm("a", OTHER_MODERN)).toBe("N"); // 주소를 직접 쳐도 다른 회사는 엔택스 서식이 안 나온다
    expect(resolveInvoiceForm("n", OSUNG_CLASSIC)).toBe("B"); // 클래식 회사는 N형이 안 나온다
  });
  it("알 수 없는 값은 테마 기본", () => {
    expect(resolveInvoiceForm("x", OTHER_MODERN)).toBe("N");
    expect(resolveInvoiceForm("", OSUNG_CLASSIC)).toBe("B");
  });
});

describe("invoiceFormOptionGroup", () => {
  it("서식 → 주소값", () => {
    expect(invoiceFormParam("N")).toBe("n");
    expect(invoiceFormParam("A")).toBe("a");
    expect(invoiceFormParam("B")).toBe("b");
    expect(invoiceFormParam("NB")).toBe("nb");
  });
  it("고를 게 하나뿐이면 서식 줄 자체를 감춘다", () => {
    expect(invoiceFormOptionGroup("N", OTHER_CLASSIC)).toBeNull();
  });
  it("모던 그리드 회사는 엘보닉스 A·B형만(엔택스는 안 보임)", () => {
    const g = invoiceFormOptionGroup("N", OTHER_MODERN);
    expect(g?.options.map((o) => o.label)).toEqual(["엘보닉스 N-A형", "엘보닉스 N-B형"]);
  });
  it("오성테크 모던은 이름이 붙은 4개", () => {
    const g = invoiceFormOptionGroup("N", OSUNG_MODERN);
    expect(g?.options).toEqual([
      { value: "n", label: "엘보닉스 N-A형" },
      { value: "nb", label: "엘보닉스 N-B형" },
      { value: "b", label: "엔택스 B형" },
      { value: "a", label: "엔택스 A형" },
    ]);
    expect(g?.current).toBe("n");
  });
});
