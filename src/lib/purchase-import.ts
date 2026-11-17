// "입고 불러오기"(매출 등록)와 "매입에서 불러오기"(할일 등록)가 보여 줄 매입 품목을 고른다.
// 기준은 재고 숫자가 아니라 "서류 연결 기록"이다 — 재고(선입선출 남은 수량)는 불러온 입고분과 상관없이 오래된 입고분부터 줄기 때문에,
// 그걸로 "이미 불러왔나"를 판단하면 같은 입고를 또 불러오거나 안 불러온 입고가 사라지는 구멍이 생긴다.
// 그래서 판매 품목에 남긴 연결(sales_order_items.source_purchase_item_id)의 수량 합만 입고 수량에서 뺀다.
// 판매를 수정/삭제하면 연결도 같이 바뀌어 수량이 자동으로 돌아온다.
export type PurchaseImportRow<T> = T & { id: string; quantity: number };

export function pickImportablePurchaseItems<T>(
  rows: PurchaseImportRow<T>[],
  linkedQuantityById: Map<string, number>,
): (T & { id: string; quantity: number; receivedQuantity: number })[] {
  const out: (T & { id: string; quantity: number; receivedQuantity: number })[] = [];
  for (const row of rows) {
    const usable = row.quantity - (linkedQuantityById.get(row.id) ?? 0);
    if (usable <= 0) continue; // 이미 전부 불러옴
    out.push({ ...row, quantity: usable, receivedQuantity: row.quantity });
  }
  return out;
}

// 연결된 판매 품목 목록에서 입고 품목별 연결 수량 합을 만든다.
export function sumLinkedQuantity(links: { source_purchase_item_id: string | null; quantity: number | string }[]): Map<string, number> {
  const sums = new Map<string, number>();
  for (const link of links) {
    if (!link.source_purchase_item_id) continue;
    sums.set(link.source_purchase_item_id, (sums.get(link.source_purchase_item_id) ?? 0) + Number(link.quantity));
  }
  return sums;
}
