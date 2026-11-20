import { describe, expect, it } from "vitest";
import { orderSelectionChips } from "./order-selection-chips";

const labels = { paid: "수금완료", partial: "일부수금", unpaid: "미수" };

describe("orderSelectionChips", () => {
  it("매출: 구분·과세·수금 상태 칩, 미수는 노랑 강조", () => {
    const r = orderSelectionChips({ kindLabel: "매출", kindTone: "info", taxType: "과세", paymentStatus: "unpaid", paymentLabels: labels });
    expect(r.chips.map((c) => c.label)).toEqual(["매출", "과세", "미수"]);
    expect(r.accent).toBe("warn");
  });
  it("완료는 초록 강조, 면세는 노랑 칩", () => {
    const r = orderSelectionChips({ kindLabel: "매출", kindTone: "info", taxType: "면세", paymentStatus: "paid", paymentLabels: labels });
    expect(r.accent).toBe("success");
    expect(r.chips[1]).toEqual({ tone: "warn", label: "면세" });
  });
  it("반품은 다른 상태보다 빨강 강조가 우선", () => {
    const r = orderSelectionChips({ kindLabel: "반품", kindTone: "danger", paymentStatus: "paid", paymentLabels: labels, isReturn: true });
    expect(r.accent).toBe("danger");
  });
  it("수금·지급 행은 상태 칩이 없고, 계산서·이월 칩은 값이 있을 때만", () => {
    const a = orderSelectionChips({ kindLabel: "수금", kindTone: "ok", paymentStatus: "paid", paymentLabels: labels, skipPayment: true });
    expect(a.chips.map((c) => c.label)).toEqual(["수금"]);
    expect(a.accent).toBe("primary");
    const b = orderSelectionChips({ kindLabel: "매출", kindTone: "info", paymentLabels: labels, invoiceLabel: "계산서 발행", isCarryover: true });
    expect(b.chips.map((c) => c.label)).toEqual(["매출", "계산서 발행", "익월 이월"]);
  });
  it("상태를 모르면(undefined) 상태 칩 없이 기본 강조", () => {
    const r = orderSelectionChips({ kindLabel: "매입", kindTone: "info", paymentLabels: labels });
    expect(r.chips).toHaveLength(1);
    expect(r.accent).toBe("primary");
  });
});
