// 재고 상태(화면 표시용) — 안전재고(reorderPoint)가 설정된 품목만 판단한다.
//   low  : 현재고 ≤ 안전재고            → 재주문 필요
//   near : 안전재고 < 현재고 ≤ 안전재고 × NEAR_STOCK_RATIO → 근접(곧 부족)
//   ok   : 그 외(안전재고 미설정 포함)
// 알림/재주문 제안(notifications.ts 등)은 별도 기준(0 포함)을 쓰므로 여기서 건드리지 않는다.
export const NEAR_STOCK_RATIO = 1.2;

export type StockStatus = "low" | "near" | "ok";

export function stockStatus(quantity: number, reorderPoint: number | null | undefined): StockStatus {
  const point = reorderPoint ?? 0;
  if (point <= 0) return "ok";
  if (quantity <= point) return "low";
  if (quantity <= point * NEAR_STOCK_RATIO) return "near";
  return "ok";
}

export function isLowStock(quantity: number, reorderPoint: number | null | undefined): boolean {
  return stockStatus(quantity, reorderPoint) === "low";
}

export const STOCK_STATUS_BADGE: Record<StockStatus, { tone: "danger" | "warn" | "ok"; label: string }> = {
  low: { tone: "danger", label: "재주문 필요" },
  near: { tone: "warn", label: "근접" },
  ok: { tone: "ok", label: "정상" },
};
