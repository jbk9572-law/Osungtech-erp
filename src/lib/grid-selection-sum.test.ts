import { describe, expect, it } from "vitest";
import { parseCellNumber, summarizeCells } from "./grid-selection-sum";

describe("parseCellNumber", () => {
  it("쉼표·공백·원·마이너스를 읽는다", () => {
    expect(parseCellNumber("1,240,000")).toBe(1240000);
    expect(parseCellNumber(" 3,500 원 ")).toBe(3500);
    expect(parseCellNumber("-390,000")).toBe(-390000);
    expect(parseCellNumber("△2,400")).toBe(-2400);
    expect(parseCellNumber("12.5")).toBe(12.5);
  });
  it("숫자가 아니면 null", () => {
    expect(parseCellNumber("")).toBeNull();
    expect(parseCellNumber("2026-11-19")).toBeNull();
    expect(parseCellNumber("-")).toBeNull();
    expect(parseCellNumber("필터지 외1")).toBeNull();
    expect(parseCellNumber("3건")).toBeNull();
  });
});

describe("summarizeCells", () => {
  it("합계·평균·개수(숫자 칸만)", () => {
    expect(summarizeCells(["1,000", "2,000", "한솔", "3,000"])).toEqual({ count: 3, sum: 6000, average: 2000 });
  });
  it("숫자 칸이 2개 미만이면 null", () => {
    expect(summarizeCells(["1,000"])).toBeNull();
    expect(summarizeCells(["가", "나"])).toBeNull();
  });
  it("소수 잡음을 정리한다", () => {
    expect(summarizeCells(["0.1", "0.2"])?.sum).toBe(0.3);
  });
});
