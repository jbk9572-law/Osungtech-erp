import { describe, expect, it } from "vitest";
import { calcLocalIncomeTax, lookupIncomeTax, type WithholdingTaxBracket } from "./withholding-tax";

function bracket(overrides: Partial<WithholdingTaxBracket> = {}): WithholdingTaxBracket {
  return {
    salary_from: 0,
    salary_to: null,
    dependents_1: 0,
    dependents_2: 0,
    dependents_3: 0,
    dependents_4: 0,
    dependents_5: 0,
    dependents_6: 0,
    dependents_7: 0,
    dependents_8: 0,
    dependents_9: 0,
    dependents_10: 0,
    dependents_11: 0,
    ...overrides,
  };
}

describe("lookupIncomeTax", () => {
  const brackets: WithholdingTaxBracket[] = [
    bracket({ salary_from: 0, salary_to: 2000000, dependents_1: 10000, dependents_2: 5000 }),
    bracket({ salary_from: 2000000, salary_to: 3000000, dependents_1: 50000, dependents_2: 30000 }),
    bracket({ salary_from: 3000000, salary_to: null, dependents_1: 100000, dependents_2: 80000 }),
  ];

  it("구간 하한(포함)에서 그 구간 값을 쓴다", () => {
    expect(lookupIncomeTax(brackets, 2000000, 1)).toBe(50000);
  });

  it("구간 상한 미만까지 같은 구간", () => {
    expect(lookupIncomeTax(brackets, 2999999, 1)).toBe(50000);
  });

  it("상한 없는 마지막 구간은 그 이상 전부 매칭", () => {
    expect(lookupIncomeTax(brackets, 100000000, 1)).toBe(100000);
  });

  it("부양가족 수에 맞는 열을 고른다", () => {
    expect(lookupIncomeTax(brackets, 2500000, 2)).toBe(30000);
  });

  it("부양가족 11명 초과는 11명 칸으로 단순화한다", () => {
    const withMax = [bracket({ salary_from: 0, salary_to: null, dependents_11: 12345 })];
    expect(lookupIncomeTax(withMax, 1000000, 20)).toBe(12345);
  });

  it("어떤 구간에도 안 맞으면(빈 표 등) 0", () => {
    expect(lookupIncomeTax([], 1000000, 1)).toBe(0);
  });
});

describe("calcLocalIncomeTax", () => {
  it("소득세의 10%를 원단위 반올림", () => {
    expect(calcLocalIncomeTax(12345)).toBe(1235);
    expect(calcLocalIncomeTax(50000)).toBe(5000);
  });
});
