import { describe, expect, it } from "vitest";
import {
  applyProductToRow,
  blankItemRow,
  buildItemRow,
  isBlankItemRow,
  sumItemRows,
  toMobileEntryItems,
  validItemRows,
} from "./item-entry-rows";

const prod = { id: "p1", name: "크라프트지", spec: "605*685" };

describe("item-entry-rows", () => {
  it("빈 줄 판정: 품목도 수량도 없을 때만 빈 줄", () => {
    expect(isBlankItemRow(blankItemRow(0))).toBe(true);
    expect(isBlankItemRow({ ...blankItemRow(0), productId: "p1" })).toBe(false);
    expect(isBlankItemRow({ ...blankItemRow(0), quantity: 3 })).toBe(false);
  });
  it("buildItemRow는 품목 규격을 채운다", () => {
    expect(buildItemRow(2, prod, "p1", 5, 100)).toEqual({
      key: 2, productId: "p1", spec: "605*685", quantity: 5, unitPrice: 100, remark: "",
    });
    expect(buildItemRow(0, undefined, "x", 1, 0).spec).toBe("");
  });
  it("applyProductToRow: 입력된 단가는 유지, 없으면 기본 단가", () => {
    const row = { ...blankItemRow(0), spec: "직접", unitPrice: 0 };
    expect(applyProductToRow(row, "p1", prod, 700)).toEqual({ productId: "p1", spec: "605*685", unitPrice: 700 });
    expect(applyProductToRow({ ...row, unitPrice: 50 }, "p1", undefined, 700)).toEqual({
      productId: "p1", spec: "직접", unitPrice: 50,
    });
  });
  it("유효 줄은 품목+수량>0, 합계는 수량×단가 합", () => {
    const rows = [
      buildItemRow(0, prod, "p1", 2, 100),
      buildItemRow(1, prod, "p1", 0, 100),
      blankItemRow(2),
    ];
    expect(validItemRows(rows)).toHaveLength(1);
    expect(sumItemRows(validItemRows(rows))).toBe(200);
  });
  it("모바일 매핑은 빈 줄을 뺀다", () => {
    const items = toMobileEntryItems([buildItemRow(0, prod, "p1", 2, 100), blankItemRow(1)], () => "이름");
    expect(items).toEqual([{ key: 0, name: "이름", spec: "605*685", quantity: 2, price: 100, amount: 200 }]);
  });
});
