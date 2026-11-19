import { describe, expect, it } from "vitest";
import { isLowStock, stockStatus } from "./stock-status";

describe("stockStatus", () => {
  it("안전재고 미설정/0이면 항상 정상", () => {
    expect(stockStatus(0, null)).toBe("ok");
    expect(stockStatus(0, 0)).toBe("ok");
    expect(stockStatus(5, undefined)).toBe("ok");
  });
  it("안전재고 이하는 재주문 필요(경계 포함)", () => {
    expect(stockStatus(100, 100)).toBe("low");
    expect(stockStatus(-3, 100)).toBe("low");
  });
  it("안전재고 120% 이하는 근접(경계 포함), 넘으면 정상", () => {
    expect(stockStatus(101, 100)).toBe("near");
    expect(stockStatus(120, 100)).toBe("near");
    expect(stockStatus(121, 100)).toBe("ok");
  });
  it("소수 수량도 같은 기준", () => {
    expect(stockStatus(10.5, 10)).toBe("near");
    expect(isLowStock(9.99, 10)).toBe(true);
  });
});
