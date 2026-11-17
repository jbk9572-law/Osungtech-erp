// "입고 불러오기"(매출 등록)와 "매입에서 불러오기"(할일 등록)가 보여 줄 매입 품목을 고른다 — 이미 전부 출고된 입고는 빼고, 일부만 나간 입고는
// 남은 수량만 가져온다. 안 그러면 같은 입고를 두 번 출고하는 이중 등록이 생긴다.
// remainingQuantity는 매입 품목의 FIFO 남은 수량(purchase_order_items.remaining_quantity — 매출이 등록되면 DB가 줄인다).
// 값이 없으면(옛 데이터 등) 판단할 수 없으니 전체 수량으로 보여 준다.
export type PurchaseImportRow<T> = T & { quantity: number; remainingQuantity: number | null };

export function pickImportablePurchaseItems<T>(rows: PurchaseImportRow<T>[]): (T & { quantity: number; receivedQuantity: number })[] {
  const out: (T & { quantity: number; receivedQuantity: number })[] = [];
  for (const row of rows) {
    const remaining = row.remainingQuantity;
    if (remaining !== null && remaining <= 0) continue; // 이미 전부 출고됨
    const usable = remaining === null ? row.quantity : Math.min(remaining, row.quantity);
    out.push({ ...row, quantity: usable, receivedQuantity: row.quantity });
  }
  return out;
}
