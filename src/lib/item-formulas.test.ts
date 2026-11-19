import { describe, expect, it } from "vitest";
import { attachItemFormulas, buildItemFormulas, itemKey, sanitizeFormula } from "./item-formulas";

describe("sanitizeFormula", () => {
  it("결과가 값과 같을 때만 식을 인정한다", () => {
    expect(sanitizeFormula("=600*2", 1200)).toBe("=600*2");
    expect(sanitizeFormula("=600*2", 1300)).toBeNull();
    expect(sanitizeFormula("600*2", 1200)).toBeNull();
    expect(sanitizeFormula("=abc", 1)).toBeNull();
    expect(sanitizeFormula(null, 1)).toBeNull();
    expect(sanitizeFormula("=" + "1+".repeat(60) + "1", 61)).toBeNull(); // 너무 긴 식
  });
  it("소수 계산 오차는 허용한다", () => {
    expect(sanitizeFormula("=0.1+0.2", 0.3)).toBe("=0.1+0.2");
  });
});

describe("buildItemFormulas", () => {
  it("검증된 식이 있는 줄만 담는다", () => {
    const out = buildItemFormulas([
      { productId: "p1", quantity: 1200, quantityFormula: "=600*2" },
      { productId: "p2", quantity: 10 },
      { productId: "p3", quantity: 5, quantityFormula: "=3+3" }, // 값과 안 맞음 → 버림
      { customName: "소프너 교체", quantity: 2, unitPrice: 25, unitPriceFormula: "=20+5" },
    ]);
    expect(out).toEqual([{ k: "p1", q: "=600*2" }, { k: "c:소프너 교체", p: "=20+5" }]);
  });
  it("매입은 unitCost를 단가로 본다", () => {
    expect(buildItemFormulas([{ productId: "p1", quantity: 1, unitCost: 25, unitPriceFormula: "=20+5" }])).toEqual([{ k: "p1", p: "=20+5" }]);
  });
});

describe("attachItemFormulas", () => {
  const stored = [{ k: "p1", q: "=600*2" }, { k: "p1", q: "=500+500" }];
  it("같은 품목이 여러 줄이어도 결과가 맞는 줄에 하나씩 짝짓는다", () => {
    const rows = [
      { productId: "p1", quantity: 1000, price: 1 },
      { productId: "p1", quantity: 1200, price: 1 },
    ];
    const r = attachItemFormulas(rows, stored);
    expect(r[0].quantityFormula).toBe("=500+500");
    expect(r[1].quantityFormula).toBe("=600*2");
  });
  it("값이 바뀐 줄에는 옛 식을 붙이지 않는다", () => {
    const r = attachItemFormulas([{ productId: "p1", quantity: 999, price: 1 }], stored);
    expect(r[0]).toEqual({ quantityFormula: null, unitPriceFormula: null });
  });
  it("저장값이 깨졌어도(배열 아님) 안전하다", () => {
    expect(attachItemFormulas([{ productId: "p1", quantity: 1, price: 1 }], "oops")[0].quantityFormula).toBeNull();
    expect(itemKey({ customName: " 직접 " })).toBe("c:직접");
  });
});
