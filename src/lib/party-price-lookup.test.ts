import { describe, expect, it } from "vitest";
import {
  buildPartyProductMap,
  buildPartyProductNoteMap,
  lookupPartyProductValue,
  getMostRecentLotNumber,
} from "./party-price-lookup";

describe("buildPartyProductMap / lookupPartyProductValue", () => {
  it("partyId:productId 키로 값을 찾을 수 있다", () => {
    const rows = [
      { customer_id: "c1", product_id: "p1", unit_price: "100" },
      { customer_id: "c2", product_id: "p1", unit_price: "200" },
    ];
    const map = buildPartyProductMap(
      rows,
      (r) => r.customer_id,
      (r) => r.product_id,
      (r) => Number(r.unit_price),
    );
    expect(lookupPartyProductValue(map, "c1", "p1")).toBe(100);
    expect(lookupPartyProductValue(map, "c2", "p1")).toBe(200);
    expect(lookupPartyProductValue(map, "c3", "p1")).toBeUndefined();
  });
});

describe("buildPartyProductNoteMap", () => {
  it("메모가 있는 조합만 맵에 들어간다", () => {
    const rows = [
      { customer_id: "c1", product_id: "p1", notes: "특이사항" },
      { customer_id: "c1", product_id: "p2", notes: null },
    ];
    const map = buildPartyProductNoteMap(
      rows,
      (r) => r.customer_id,
      (r) => r.product_id,
      (r) => r.notes,
    );
    expect(map.get("c1:p1")).toBe("특이사항");
    expect(map.has("c1:p2")).toBe(false);
  });
});

describe("getMostRecentLotNumber", () => {
  const history = [
    { customerId: "c1", productId: "p1", orderDate: "2025-01-01", lotNumber: "LOT-A" },
    { customerId: "c1", productId: "p1", orderDate: "2025-03-01", lotNumber: "LOT-C" },
    { customerId: "c1", productId: "p1", orderDate: "2025-02-01", lotNumber: "LOT-B" },
    { customerId: "c1", productId: "p2", orderDate: "2025-05-01", lotNumber: "LOT-OTHER" },
  ];

  it("가장 최근 날짜의 관리번호를 돌려준다", () => {
    const result = getMostRecentLotNumber(
      history,
      (h) => h.customerId === "c1" && h.productId === "p1",
      (h) => h.orderDate,
      (h) => h.lotNumber,
    );
    expect(result).toBe("LOT-C");
  });

  it("일치하는 이력이 없으면 null을 돌려준다", () => {
    const result = getMostRecentLotNumber(
      history,
      (h) => h.customerId === "none" && h.productId === "p1",
      (h) => h.orderDate,
      (h) => h.lotNumber,
    );
    expect(result).toBeNull();
  });

  it("관리번호가 없는 이력은 제외한다", () => {
    const withEmpty = [...history, { customerId: "c1", productId: "p1", orderDate: "2025-04-01", lotNumber: null }];
    const result = getMostRecentLotNumber(
      withEmpty,
      (h) => h.customerId === "c1" && h.productId === "p1",
      (h) => h.orderDate,
      (h) => h.lotNumber,
    );
    expect(result).toBe("LOT-C");
  });
});
