import { describe, expect, it } from "vitest";
import { calcVat, calcVatForTaxType } from "./tax";

describe("calcVat", () => {
  it("공급가액의 10%를 원 단위로 반올림한다", () => {
    expect(calcVat(100000)).toBe(10000);
    expect(calcVat(25)).toBe(3);
    expect(calcVat(0)).toBe(0);
  });
  it("음수(반품/취소분)도 양수와 대칭으로 반올림한다", () => {
    expect(calcVat(-25)).toBe(-3);
    expect(calcVat(25) + calcVat(-25)).toBe(0);
    expect(calcVat(-100000)).toBe(-10000);
  });
});

describe("calcVatForTaxType", () => {
  it("과세만 세액을 계산하고 면세/영세는 0이다", () => {
    expect(calcVatForTaxType(100000, "과세")).toBe(10000);
    expect(calcVatForTaxType(100000, "면세")).toBe(0);
    expect(calcVatForTaxType(100000, "영세")).toBe(0);
    expect(calcVatForTaxType(100000, null)).toBe(0);
  });
});
