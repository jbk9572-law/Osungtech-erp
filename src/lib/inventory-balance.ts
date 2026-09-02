// inventory_transactions는 변경 전/후 수량이 아니라 변경분(quantity, in/
// adjustment는 그대로 부호 있는 값·out은 항상 양수라서 부호를 뒤집어야
// 함)만 남긴다. 특정 거래 시점의 "그 전/그 후" 재고를 보여주려면, 그
// 품목의 전체 이력을 시간순으로 처음부터 누적해서 각 거래 직후의 잔량을
// 재구성해야 한다 — /inventory/[productId] 페이지가 이미 쓰는 방식과
// 같은 계산을, 재고 실사 이력·변경이력(감사로그) 화면에서도 재사용한다.
export function computeBalanceAfterById(
  transactionsAscending: { id: string; type: string; quantity: number }[]
): Map<string, number> {
  let balance = 0;
  const balanceAfterById = new Map<string, number>();
  for (const t of transactionsAscending) {
    const signedQty = t.type === "out" ? -Math.abs(t.quantity) : t.quantity;
    balance += signedQty;
    balanceAfterById.set(t.id, balance);
  }
  return balanceAfterById;
}
