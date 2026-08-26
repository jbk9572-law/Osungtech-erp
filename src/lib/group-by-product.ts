export type ProductGroup<T> = {
  key: string;
  items: T[];
  totalQuantity: number;
  totalAmount: number;
};

// 거래처 상세내역처럼 날짜순으로 죽 나열하면 같은 품목이 여기저기 흩어져
// 헷갈리는 목록을, 품목별로 묶고 소계를 낸다. 그룹 순서는 입력 배열에서
// 그 품목이 처음 등장한 순서를 그대로 따른다 — 보통 날짜 오름차순으로
// 정렬된 배열을 넘기므로, 결과적으로 "먼저 거래된 품목이 먼저" 나온다.
export function groupByProductKey<T>(
  rows: T[],
  keyOf: (row: T) => string,
  quantityOf: (row: T) => number,
  amountOf: (row: T) => number,
): ProductGroup<T>[] {
  const groups = new Map<string, ProductGroup<T>>();
  for (const row of rows) {
    const key = keyOf(row);
    let group = groups.get(key);
    if (!group) {
      group = { key, items: [], totalQuantity: 0, totalAmount: 0 };
      groups.set(key, group);
    }
    group.items.push(row);
    group.totalQuantity += quantityOf(row);
    group.totalAmount += amountOf(row);
  }
  return Array.from(groups.values());
}
