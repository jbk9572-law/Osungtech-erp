import { describe, expect, it } from "vitest";
import { computePaperStockDelta } from "./paper-calc-sync";

// 매출/매입 자동반영 로직을 하나로 합치면서 재고 증감 부호를
// "방향 × (새 수량 - 이전 수량)"이라는 공식 하나로 통일했다 — 여기서
// 부호가 뒤집히면 실제 재고가 반대 방향으로 조용히 틀어지므로, 리팩터
// 전 개별 함수들이 계산하던 값과 정확히 같은 결과가 나오는지 각
// 시나리오별로 고정해둔다.
describe("computePaperStockDelta", () => {
  it("매출: 새 TG0 줄을 처음 만들면(0 -> totalReams) 그만큼 재고가 준다", () => {
    expect(computePaperStockDelta("sales_order_id", 0, 50)).toBe(-50);
  });

  it("매출: 계산 수량이 늘면(50 -> 80) 재고가 더 줄어든다", () => {
    expect(computePaperStockDelta("sales_order_id", 50, 80)).toBe(-30);
  });

  it("매출: 계산 수량이 줄면(80 -> 50) 뺐던 재고를 되돌려준다", () => {
    expect(computePaperStockDelta("sales_order_id", 80, 50)).toBe(30);
  });

  it("매출: 계산이 전부 삭제되면(50 -> 0) 뺐던 재고를 전부 되돌려준다", () => {
    expect(computePaperStockDelta("sales_order_id", 50, 0)).toBe(50);
  });

  it("매입: 새 TG0 줄을 처음 만들면(0 -> totalReams) 그만큼 재고가 는다", () => {
    expect(computePaperStockDelta("purchase_order_id", 0, 50)).toBe(50);
  });

  it("매입: 계산 수량이 늘면(50 -> 80) 재고가 더 는다", () => {
    expect(computePaperStockDelta("purchase_order_id", 50, 80)).toBe(30);
  });

  it("매입: 계산 수량이 줄면(80 -> 50) 더했던 재고를 되돌려준다", () => {
    expect(computePaperStockDelta("purchase_order_id", 80, 50)).toBe(-30);
  });

  it("매입: 계산이 전부 삭제되면(50 -> 0) 더했던 재고를 전부 되돌려준다", () => {
    expect(computePaperStockDelta("purchase_order_id", 50, 0)).toBe(-50);
  });

  it("매출 오버라이드: 자동값보다 낮게 고정하면 그 차이만큼 재고를 돌려준다", () => {
    expect(computePaperStockDelta("sales_order_id", 50, 30)).toBe(20);
  });

  it("매입 오버라이드: 자동값보다 높게 고정하면 그 차이만큼 재고가 는다", () => {
    expect(computePaperStockDelta("purchase_order_id", 50, 70)).toBe(20);
  });

  it("변화가 없으면(oldQuantity === newQuantity) delta는 0이다", () => {
    // -1 * 0은 자바스크립트에서 -0이라 Object.is 기준 toBe(0)과 다르게
    // 잡히지만, 실제 호출부는 항상 `=== 0`으로 비교해서 -0도 0으로
    // 취급한다(insertInventoryAdjustment) — 그 비교와 동일한 기준으로 검증한다.
    expect(computePaperStockDelta("sales_order_id", 40, 40) === 0).toBe(true);
    expect(computePaperStockDelta("purchase_order_id", 40, 40) === 0).toBe(true);
  });
});
