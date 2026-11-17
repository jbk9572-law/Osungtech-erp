import { describe, expect, it } from "vitest";
import { pickImportablePurchaseItems, sumLinkedQuantity } from "./purchase-import";

const row = (id: string, quantity: number) => ({ id, quantity });
const linked = (entries: [string, number][]) => new Map(entries);

describe("pickImportablePurchaseItems", () => {
  it("이미 전부 불러온 입고는 뺀다", () => {
    expect(pickImportablePurchaseItems([row("a", 100), row("b", 50)], linked([["a", 100]])).map((r) => r.id)).toEqual(["b"]);
  });
  it("일부만 불러온 입고는 남은 수량만 보여 주고 받은 수량은 따로 보관한다", () => {
    const [r] = pickImportablePurchaseItems([row("a", 100)], linked([["a", 60]]));
    expect(r.quantity).toBe(40);
    expect(r.receivedQuantity).toBe(100);
  });
  it("연결이 없으면 전체 수량(재고가 줄었어도 상관없음)", () => {
    expect(pickImportablePurchaseItems([row("a", 100)], linked([]))[0].quantity).toBe(100);
  });
  it("연결이 입고 수량을 넘어도(수정 등) 목록에는 나오지 않는다", () => {
    expect(pickImportablePurchaseItems([row("a", 100)], linked([["a", 120]]))).toEqual([]);
  });
});

describe("sumLinkedQuantity", () => {
  it("입고 품목별로 연결된 판매 수량을 합친다(연결 없는 줄·문자열 수량 처리)", () => {
    const sums = sumLinkedQuantity([
      { source_purchase_item_id: "a", quantity: 10 },
      { source_purchase_item_id: "a", quantity: "5" },
      { source_purchase_item_id: null, quantity: 99 },
      { source_purchase_item_id: "b", quantity: 1 },
    ]);
    expect(sums.get("a")).toBe(15);
    expect(sums.get("b")).toBe(1);
    expect(sums.size).toBe(2);
  });
});
