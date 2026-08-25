import { describe, expect, it } from "vitest";
import { formatNumOrDash } from "./format-num-or-dash";

describe("formatNumOrDash", () => {
  it("0이면 하이픈을 반환한다", () => {
    expect(formatNumOrDash(0)).toBe("-");
  });

  it("null/undefined면 하이픈을 반환한다", () => {
    expect(formatNumOrDash(null)).toBe("-");
    expect(formatNumOrDash(undefined)).toBe("-");
  });

  it("양수면 천단위 콤마를 붙인 문자열을 반환한다", () => {
    expect(formatNumOrDash(12000)).toBe("12,000");
  });

  it("숫자 문자열도 처리한다", () => {
    expect(formatNumOrDash("5000")).toBe("5,000");
    expect(formatNumOrDash("0")).toBe("-");
  });
});
