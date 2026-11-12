import { describe, expect, it } from "vitest";
import { pendingPaperCalcSizeLines, resolveTg0Quantity, summarizePendingPaperCalc } from "./pending-paper-calc";

describe("summarizePendingPaperCalc", () => {
  it("아무것도 없으면 null", () => {
    expect(summarizePendingPaperCalc(null, [])).toBeNull();
  });
  it("임시 저장분과 가져온 계산을 합친다", () => {
    const pending = JSON.stringify({ totalSheet: 3, totalPaper: 10 });
    expect(summarizePendingPaperCalc(pending, [{ totalSheet: 2, totalPaper: 5 }])).toEqual({ totalSheet: 5, totalPaper: 15 });
  });
  it("가져온 계산만 있어도 합친다", () => {
    expect(summarizePendingPaperCalc(null, [{ totalSheet: 1.5, totalPaper: 4 }, { totalSheet: 1, totalPaper: 2 }])).toEqual({
      totalSheet: 2.5,
      totalPaper: 6,
    });
  });
  it("깨진 JSON은 0으로 취급한다", () => {
    expect(summarizePendingPaperCalc("{bad", [])).toBeNull();
    expect(summarizePendingPaperCalc("{bad", [{ totalSheet: 2, totalPaper: 3 }])).toEqual({ totalSheet: 2, totalPaper: 3 });
  });
  it("합계 연수가 0이면 null", () => {
    expect(summarizePendingPaperCalc(JSON.stringify({ totalSheet: 0, totalPaper: 0 }), [])).toBeNull();
  });
});

describe("pendingPaperCalcSizeLines", () => {
  it("계산이 없으면 빈 목록", () => {
    expect(pendingPaperCalcSizeLines(null, [])).toEqual([]);
  });
  it("깨진 JSON은 무시한다", () => {
    expect(pendingPaperCalcSizeLines("{bad", [])).toEqual([]);
  });
});

describe("resolveTg0Quantity", () => {
  it("계산이 없으면 수량 0, 재정의 아님", () => {
    expect(resolveTg0Quantity(null, 3)).toEqual({ quantity: 0, isOverridden: false });
  });
  it("override가 없으면 자동값", () => {
    expect(resolveTg0Quantity({ totalSheet: 3.2 }, null)).toEqual({ quantity: 3.2, isOverridden: false });
  });
  it("자동값과 다른 override는 재정의로 본다", () => {
    expect(resolveTg0Quantity({ totalSheet: 3.2 }, 3)).toEqual({ quantity: 3, isOverridden: true });
  });
  it("자동값과 같은 override는 재정의가 아니다", () => {
    expect(resolveTg0Quantity({ totalSheet: 3 }, 3)).toEqual({ quantity: 3, isOverridden: false });
  });
});
