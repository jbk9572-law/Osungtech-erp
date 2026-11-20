import { describe, expect, it } from "vitest";
import { availableInvoiceForms, invoiceFormOptionGroup, invoiceFormParam, resolveInvoiceForm } from "./invoice-form";

const OSUNG_CLASSIC = { theme: "classic-light", slug: "osungtech" };
const OSUNG_MODERN = { theme: "grid-modern", slug: "osungtech" };
const OTHER_MODERN = { theme: "grid-modern", slug: "acme" };
const OTHER_CLASSIC = { theme: "classic-light", slug: "acme" };

describe("availableInvoiceForms — 회사마다 보이는 서식이 다르다", () => {
  it("엘보닉스 A·B형은 모던 그리드에서만 선택지(엔택스는 안 보임)", () => {
    expect(availableInvoiceForms(OTHER_MODERN)).toEqual(["N", "NB"]);
  });
  it("클래식 + 오성테크 아님은 선택지 없이 엘보닉스 A형 하나(인쇄가 막히지 않게)", () => {
    expect(availableInvoiceForms(OTHER_CLASSIC)).toEqual(["N"]);
    expect(availableInvoiceForms({ theme: null, slug: null })).toEqual(["N"]);
  });
  it("오성테크는 클래식이면 엔택스 B·A형, 모던이면 엘보닉스까지 4개", () => {
    expect(availableInvoiceForms(OSUNG_CLASSIC)).toEqual(["B", "A"]);
    expect(availableInvoiceForms(OSUNG_MODERN)).toEqual(["N", "NB", "B", "A"]);
  });
});

describe("resolveInvoiceForm", () => {
  it("오성테크 클래식은 기본이 엔택스 B형", () => {
    expect(resolveInvoiceForm(undefined, OSUNG_CLASSIC)).toBe("B");
  });
  it("그 외 전부(클래식 포함)는 기본이 엘보닉스 A형", () => {
    expect(resolveInvoiceForm(undefined, OSUNG_MODERN)).toBe("N");
    expect(resolveInvoiceForm(undefined, OTHER_MODERN)).toBe("N");
    expect(resolveInvoiceForm(undefined, OTHER_CLASSIC)).toBe("N");
  });
  it("직접 고른 값은 그 회사가 쓸 수 있을 때만 따른다", () => {
    expect(resolveInvoiceForm("a", OSUNG_MODERN)).toBe("A");
    expect(resolveInvoiceForm("nb", OTHER_MODERN)).toBe("NB");
    expect(resolveInvoiceForm("nb", OTHER_CLASSIC)).toBe("N"); // 클래식 화면에는 엘보닉스 B형이 안 나온다
    expect(resolveInvoiceForm("a", OTHER_MODERN)).toBe("N"); // 주소를 직접 쳐도 다른 회사는 엔택스 서식이 안 나온다
    expect(resolveInvoiceForm("n", OSUNG_CLASSIC)).toBe("B"); // 오성테크 클래식은 엘보닉스형이 안 나온다
  });
  it("알 수 없는 값은 기본", () => {
    expect(resolveInvoiceForm("x", OTHER_MODERN)).toBe("N");
    expect(resolveInvoiceForm("", OSUNG_CLASSIC)).toBe("B");
  });
});

describe("invoiceFormOptionGroup", () => {
  it("서식 → 주소값", () => {
    expect(invoiceFormParam("N")).toBe("n");
    expect(invoiceFormParam("NB")).toBe("nb");
    expect(invoiceFormParam("A")).toBe("a");
    expect(invoiceFormParam("B")).toBe("b");
  });
  it("모던 그리드 일반 회사는 엘보닉스 A·B형만", () => {
    expect(invoiceFormOptionGroup("N", OTHER_MODERN)?.options.map((o) => o.label)).toEqual(["엘보닉스 A형", "엘보닉스 B형"]);
  });
  it("클래식 일반 회사는 고를 게 없어 서식 줄 자체가 없다", () => {
    expect(invoiceFormOptionGroup("N", OTHER_CLASSIC)).toBeNull();
  });
  it("오성테크 모던은 이름이 붙은 4개", () => {
    const g = invoiceFormOptionGroup("N", OSUNG_MODERN);
    expect(g?.options.map((o) => `${o.value}:${o.label}`)).toEqual(["n:엘보닉스 A형", "nb:엘보닉스 B형", "b:엔택스 B형", "a:엔택스 A형"]);
    expect(g?.current).toBe("n");
  });
  it("오성테크 클래식은 엔택스 둘 (고를 게 둘 이상이라 줄이 나온다)", () => {
    expect(invoiceFormOptionGroup("B", OSUNG_CLASSIC)?.options.map((o) => o.label)).toEqual(["엔택스 B형", "엔택스 A형"]);
  });
});
