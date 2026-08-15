import { describe, expect, it } from "vitest";
import { evalFormula } from "./eval-formula";

describe("evalFormula", () => {
  it("사칙연산을 계산한다", () => {
    expect(evalFormula("1+2")).toBe(3);
    expect(evalFormula("10-4")).toBe(6);
    expect(evalFormula("3*4")).toBe(12);
    expect(evalFormula("10/4")).toBe(2.5);
  });

  it("연산자 우선순위를 지킨다", () => {
    expect(evalFormula("2+3*4")).toBe(14);
    expect(evalFormula("(2+3)*4")).toBe(20);
  });

  it("음수와 단항 부호를 처리한다", () => {
    expect(evalFormula("-5+10")).toBe(5);
    expect(evalFormula("5*-2")).toBe(-10);
  });

  it("공백이 섞여도 계산한다", () => {
    expect(evalFormula(" 1 + 2 * 3 ")).toBe(7);
  });

  it("빈 문자열은 null을 반환한다", () => {
    expect(evalFormula("")).toBeNull();
    expect(evalFormula("   ")).toBeNull();
  });

  it("숫자·연산자·괄호 외의 문자가 섞이면 null을 반환한다", () => {
    expect(evalFormula("1+a")).toBeNull();
    expect(evalFormula("=1+1")).toBeNull();
    expect(evalFormula("1+2; DROP TABLE")).toBeNull();
  });

  it("0으로 나누면 null을 반환한다", () => {
    expect(evalFormula("5/0")).toBeNull();
  });

  it("괄호가 안 맞으면 null을 반환한다", () => {
    expect(evalFormula("(1+2")).toBeNull();
    expect(evalFormula("1+2)")).toBeNull();
  });

  it("연산자로 끝나는 등 불완전한 식은 null을 반환한다", () => {
    expect(evalFormula("1+")).toBeNull();
    expect(evalFormula("*3")).toBeNull();
  });
});
