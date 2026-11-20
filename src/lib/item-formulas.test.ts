import { describe, expect, it } from "vitest";
import { attachFormulaRows, buildFormulaRows, itemKey, sanitizeFormula } from "./item-formulas";

describe("sanitizeFormula", () => {
  it("결과가 값과 같을 때만 식을 인정한다", () => {
    expect(sanitizeFormula("=600*2", 1200)).toBe("=600*2");
    expect(sanitizeFormula("=600*2", 1300)).toBeNull();
    expect(sanitizeFormula("600*2", 1200)).toBeNull();
    expect(sanitizeFormula("=abc", 1)).toBeNull();
    expect(sanitizeFormula(null, 1)).toBeNull();
    expect(sanitizeFormula("=" + "1+".repeat(60) + "1", 61)).toBeNull();
  });
  it("소수 계산 오차는 허용한다", () => {
    expect(sanitizeFormula("=0.1+0.2", 0.3)).toBe("=0.1+0.2");
  });
});

describe("buildFormulaRows", () => {
  it("검증된 식만 칸별 행으로 만든다", () => {
    expect(
      buildFormulaRows([
        { productId: "p1", quantity: 1200, quantityFormula: "=600*2" },
        { productId: "p2", quantity: 10 },
        { productId: "p3", quantity: 5, quantityFormula: "=3+3" },
        { customName: "소프너 교체", quantity: 2, unitPrice: 25, unitPriceFormula: "=20+5" },
      ]),
    ).toEqual([
      { line_key: "p1", field: "quantity", formula: "=600*2" },
      { line_key: "c:소프너 교체", field: "unit_price", formula: "=20+5" },
    ]);
  });
  it("매입은 unitCost를 단가로 본다", () => {
    expect(buildFormulaRows([{ productId: "p1", quantity: 1, unitCost: 25, unitPriceFormula: "=20+5" }])).toEqual([
      { line_key: "p1", field: "unit_price", formula: "=20+5" },
    ]);
  });
});

describe("attachFormulaRows", () => {
  const stored = [
    { line_key: "p1", field: "quantity", formula: "=600*2" },
    { line_key: "p1", field: "quantity", formula: "=500+500" },
    { line_key: "p1", field: "unit_price", formula: "=20+5" },
  ];
  it("같은 품목이 여러 줄이어도 결과가 맞는 줄에 하나씩 짝짓는다", () => {
    const r = attachFormulaRows(
      [
        { productId: "p1", quantity: 1000, price: 25 },
        { productId: "p1", quantity: 1200, price: 1 },
      ],
      stored,
    );
    expect(r[0]).toEqual({ quantityFormula: "=500+500", unitPriceFormula: "=20+5" });
    expect(r[1]).toEqual({ quantityFormula: "=600*2", unitPriceFormula: null });
  });
  it("값이 바뀐 줄에는 옛 식을 붙이지 않는다", () => {
    expect(attachFormulaRows([{ productId: "p1", quantity: 999, price: 1 }], stored)[0]).toEqual({ quantityFormula: null, unitPriceFormula: null });
  });
  it("저장값이 비었어도 안전하고 직접입력 품목 키는 공백을 정리한다", () => {
    expect(attachFormulaRows([{ productId: "p1", quantity: 1, price: 1 }], [])[0].quantityFormula).toBeNull();
    expect(itemKey({ customName: " 직접 " })).toBe("c:직접");
  });
});
