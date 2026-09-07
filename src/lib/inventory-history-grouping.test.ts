import { describe, expect, it } from "vitest";
import { groupOrderCorrections, type InventoryHistoryRow } from "./inventory-history-grouping";

function row(overrides: Partial<InventoryHistoryRow>): InventoryHistoryRow {
  return {
    id: "id",
    date: "2026-09-01",
    type: "out",
    signedQty: -10,
    partnerName: null,
    note: null,
    reference: null,
    href: null,
    balance: 0,
    authorName: null,
    lotNumber: null,
    ...overrides,
  };
}

describe("groupOrderCorrections", () => {
  it("무관한 전표들은 각각 그대로 단독 줄로 남는다", () => {
    const rows = [
      row({ id: "1", reference: "purchase_order:p1", signedQty: 20 }),
      row({ id: "2", reference: "sales_order:s1", signedQty: -10 }),
    ];
    const result = groupOrderCorrections(rows);
    expect(result).toHaveLength(2);
    expect(result[0].correctionNote).toBeNull();
    expect(result[1].correctionNote).toBeNull();
  });

  it("같은 매출 전표의 되돌림+재반영을 최신 줄 하나로 합친다", () => {
    const rows = [
      row({
        id: "orig",
        date: "2026-09-01",
        reference: "sales_order:abc",
        signedQty: -10,
        partnerName: "케이이티솔루션(주)",
        balance: 90,
      }),
      row({
        id: "unrelated",
        date: "2026-09-02",
        reference: "purchase_order:xyz",
        signedQty: 20,
        partnerName: "㈜신흥필터",
        balance: 110,
      }),
      row({
        id: "reversal",
        date: "2026-09-03",
        type: "adjustment",
        reference: "sales_order_reversal:abc",
        signedQty: 10,
        partnerName: null,
        balance: 120,
      }),
      row({
        id: "reissue",
        date: "2026-09-03",
        type: "out",
        reference: "sales_order:abc",
        signedQty: -8,
        partnerName: "케이이티솔루션(주)",
        balance: 112,
      }),
    ];

    const result = groupOrderCorrections(rows);

    // orig가 사라지고, unrelated는 그대로, reversal은 흡수되고 reissue 자리에 병합 결과가 남는다.
    expect(result.map((r) => r.id)).toEqual(["unrelated", "reissue"]);
    const merged = result[1];
    expect(merged.signedQty).toBe(-8);
    expect(merged.balance).toBe(112);
    expect(merged.partnerName).toBe("케이이티솔루션(주)");
    expect(merged.correctionNote).toBe("9/1 등록 시 10개 → 8개로 수정");
  });

  it("삭제(되돌림만 있고 재반영 없음)는 삭제됨 문구를 보여주고 최초 거래처를 이어받는다", () => {
    const rows = [
      row({
        id: "orig",
        date: "2026-08-20",
        reference: "purchase_order:del1",
        signedQty: 30,
        partnerName: "㈜대성상사",
      }),
      row({
        id: "reversal",
        date: "2026-08-25",
        type: "adjustment",
        reference: "purchase_order_reversal:del1",
        signedQty: -30,
        partnerName: null,
      }),
    ];

    const result = groupOrderCorrections(rows);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("reversal");
    expect(result[0].partnerName).toBe("㈜대성상사");
    expect(result[0].correctionNote).toBe("8/20 등록된 30개가 삭제됨");
  });

  it("매입 전표와 매출 전표는 ID가 우연히 같아도 절대 섞이지 않는다", () => {
    const rows = [
      row({ id: "1", reference: "sales_order:same-id", signedQty: -5 }),
      row({ id: "2", reference: "purchase_order:same-id", signedQty: 5 }),
    ];
    const result = groupOrderCorrections(rows);
    expect(result).toHaveLength(2);
  });
});
