import { describe, expect, it } from "vitest";
import { pickImportablePurchaseItems } from "./purchase-import";

const row = (id: string, quantity: number, remainingQuantity: number | null) => ({ id, quantity, remainingQuantity });

describe("pickImportablePurchaseItems", () => {
  it("이미 전부 출고된 입고(남은 수량 0)는 뺀다", () => {
    expect(pickImportablePurchaseItems([row("a", 100, 0), row("b", 50, 50)]).map((r) => r.id)).toEqual(["b"]);
  });
  it("일부만 출고된 입고는 남은 수량만 가져온다(받은 수량은 따로 보관)", () => {
    const [r] = pickImportablePurchaseItems([row("a", 100, 40)]);
    expect(r.quantity).toBe(40);
    expect(r.receivedQuantity).toBe(100);
  });
  it("전혀 출고 안 된 입고는 전체 수량", () => {
    expect(pickImportablePurchaseItems([row("a", 100, 100)])[0].quantity).toBe(100);
  });
  it("남은 수량 정보가 없으면(null) 걸러내지 않고 전체 수량으로 보여 준다", () => {
    const [r] = pickImportablePurchaseItems([row("a", 100, null)]);
    expect(r.quantity).toBe(100);
  });
  it("남은 수량이 받은 수량보다 커도 받은 수량을 넘지 않는다", () => {
    expect(pickImportablePurchaseItems([row("a", 100, 150)])[0].quantity).toBe(100);
  });
});
