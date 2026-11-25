import { describe, expect, it } from "vitest";
import { quantityLabelByUnit, sumQuantityByUnit } from "./quantity-by-unit";

describe("quantityLabelByUnit — 단위가 다르면 합치지 않는다", () => {
  it("단위가 다른 품목은 단위별로 따로", () => {
    expect(quantityLabelByUnit([{ quantity: 225, unit: "ROLL" }, { quantity: 532, unit: "KG" }])).toBe("225 ROLL · 532 KG");
  });
  it("같은 단위끼리만 더한다", () => {
    expect(quantityLabelByUnit([{ quantity: 100, unit: "KG" }, { quantity: 20, unit: "ROLL" }, { quantity: 50, unit: "KG" }])).toBe("150 KG · 20 ROLL");
  });
  it("단위가 하나면 예전과 같은 모양", () => {
    expect(quantityLabelByUnit([{ quantity: 225, unit: "ROLL" }, { quantity: 532, unit: "ROLL" }])).toBe("757 ROLL");
  });
  it("단위가 없으면 숫자만, 빈 목록은 빈 글자", () => {
    expect(quantityLabelByUnit([{ quantity: 3 }])).toBe("3");
    expect(quantityLabelByUnit([])).toBe("");
    expect(sumQuantityByUnit([{ quantity: 1, unit: null }, { quantity: 2, unit: " " }])).toEqual([{ unit: "", quantity: 3 }]);
  });
});
