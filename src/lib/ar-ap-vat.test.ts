import { describe, expect, it } from "vitest";
import { orderTotalWithVat } from "./ar-ap";

describe("orderTotalWithVat — 미수금·미지급금에 잡히는 전표 금액", () => {
  it("과세는 공급가액 + 10%(원 단위 반올림)", () => {
    expect(orderTotalWithVat(1000, "과세")).toBe(1100);
    expect(orderTotalWithVat(1005, "과세")).toBe(1106); // 100.5 → 101
  });
  it("면세·영세·미지정은 공급가액 그대로", () => {
    expect(orderTotalWithVat(1000, "면세")).toBe(1000);
    expect(orderTotalWithVat(1000, "영세")).toBe(1000);
    expect(orderTotalWithVat(1000, null)).toBe(1000);
  });
});
