import { describe, expect, it } from "vitest";
import { formatPaperCalcSizeLines, mergePaperCalcInputItems } from "./paper-calc-summary";

describe("formatPaperCalcSizeLines", () => {
  it("가로×세로 : 수량 형식으로 줄을 만든다", () => {
    expect(formatPaperCalcSizeLines([{ width: 300, height: 400, qty: 1000 }])).toEqual([
      "300×400 : 1,000",
    ]);
  });

  it("빈 배열이면 빈 배열을 반환한다", () => {
    expect(formatPaperCalcSizeLines([])).toEqual([]);
  });
});

describe("mergePaperCalcInputItems", () => {
  it("같은 규격의 수량을 합친다", () => {
    const result = mergePaperCalcInputItems(
      [],
      [
        { name: "300×400", width: 300, height: 400, orderQty: 100 },
        { name: "300×400", width: 300, height: 400, orderQty: 50 },
      ]
    );
    expect(result).toEqual([{ width: 300, height: 400, qty: 150 }]);
  });

  it("규격이 다르면 별도 항목으로 유지한다", () => {
    const result = mergePaperCalcInputItems(
      [],
      [
        { name: "300×400", width: 300, height: 400, orderQty: 100 },
        { name: "200×250", width: 200, height: 250, orderQty: 30 },
      ]
    );
    expect(result).toEqual([
      { width: 300, height: 400, qty: 100 },
      { width: 200, height: 250, qty: 30 },
    ]);
  });

  it("기존 sizes 누적값 위에 계속 더할 수 있다 (여러 계산 합치기)", () => {
    const first = mergePaperCalcInputItems([], [{ width: 300, height: 400, orderQty: 100 }]);
    const merged = mergePaperCalcInputItems(first, [{ width: 300, height: 400, orderQty: 20 }]);
    expect(merged).toEqual([{ width: 300, height: 400, qty: 120 }]);
  });

  it("width/height/orderQty가 0이거나 없는 항목은 건너뛴다", () => {
    const result = mergePaperCalcInputItems(
      [],
      [
        { width: 0, height: 400, orderQty: 100 },
        { width: 300, height: 400, orderQty: 0 },
        { width: 300 },
        {},
      ]
    );
    expect(result).toEqual([]);
  });

  it("input_items가 배열이 아니면(null/undefined 등) 원래 sizes를 그대로 반환한다", () => {
    const sizes = [{ width: 300, height: 400, qty: 100 }];
    expect(mergePaperCalcInputItems(sizes, null)).toBe(sizes);
    expect(mergePaperCalcInputItems(sizes, undefined)).toBe(sizes);
    expect(mergePaperCalcInputItems(sizes, "not-an-array")).toBe(sizes);
  });
});
