import { describe, expect, it } from "vitest";
import { MAX_ORDER_ITEMS, parseOrderItems } from "./order-items-input";

const ok = { productId: "p1", quantity: 2, unitPrice: 100 };

describe("parseOrderItems", () => {
  it("정상 품목은 통과하고 수량 0/품목 없음 줄은 걸러낸다", () => {
    const items = parseOrderItems(JSON.stringify([ok, { productId: "p2", quantity: 0, unitPrice: 5 }, { quantity: 1, unitPrice: 5 }]), { allowCustom: true });
    expect(items).toHaveLength(1);
  });
  it("직접입력 줄은 allowCustom일 때만 허용한다", () => {
    const raw = JSON.stringify([{ customName: "운송비", quantity: 1, unitPrice: 10 }]);
    expect(parseOrderItems(raw, { allowCustom: true })).toHaveLength(1);
    expect(parseOrderItems(raw, { allowCustom: false })).toHaveLength(0);
  });
  it("음수 단가(할인 줄)는 허용한다", () => {
    expect(parseOrderItems(JSON.stringify([{ ...ok, unitPrice: -500 }]), { allowCustom: true })).toHaveLength(1);
  });
  it("형식이 잘못된 입력은 null이다", () => {
    expect(parseOrderItems("{깨짐", { allowCustom: true })).toBeNull();
    expect(parseOrderItems(JSON.stringify({ a: 1 }), { allowCustom: true })).toBeNull();
    expect(parseOrderItems(JSON.stringify([null]), { allowCustom: true })).toBeNull();
    expect(parseOrderItems(JSON.stringify([{ ...ok, quantity: "3" }]), { allowCustom: true })).toBeNull();
    expect(parseOrderItems(JSON.stringify([{ ...ok, unitPrice: 1e30 }]), { allowCustom: true })).toBeNull();
    expect(parseOrderItems(JSON.stringify([{ ...ok, quantity: 1e12 }]), { allowCustom: true })).toBeNull();
    expect(parseOrderItems(JSON.stringify([{ ...ok, customName: "x".repeat(501) }]), { allowCustom: true })).toBeNull();
  });
  it("품목 개수 상한을 넘으면 null이다", () => {
    expect(parseOrderItems(JSON.stringify(new Array(MAX_ORDER_ITEMS + 1).fill(ok)), { allowCustom: true })).toBeNull();
  });
});
