import { describe, expect, it } from "vitest";
import { computeBalanceAfterById } from "./inventory-balance";

describe("computeBalanceAfterById", () => {
  it("in/adjustment는 그대로, out은 부호를 뒤집어 누적한다", () => {
    const result = computeBalanceAfterById([
      { id: "a", type: "in", quantity: 100 },
      { id: "b", type: "out", quantity: 30 },
      { id: "c", type: "adjustment", quantity: -5 },
      { id: "d", type: "adjustment", quantity: 10 },
    ]);
    expect(result.get("a")).toBe(100);
    expect(result.get("b")).toBe(70);
    expect(result.get("c")).toBe(65);
    expect(result.get("d")).toBe(75);
  });

  it("빈 이력이면 빈 맵을 반환한다", () => {
    expect(computeBalanceAfterById([]).size).toBe(0);
  });
});
