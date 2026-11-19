import type { InvoiceItem } from "./types";

// 합계/잔금 계산 — B형(SummarySection)과 A형(InvoiceCopyA)이 똑같은 계산을 각자 들고 있지 않게 한 곳으로 모았다.
export function computeInvoiceTotals(items: InvoiceItem[], balance?: number) {
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const supplyTotal = items.reduce((sum, item) => sum + item.supplyAmount, 0);
  const taxTotal = items.reduce((sum, item) => sum + item.taxAmount, 0);
  const grandTotal = supplyTotal + taxTotal;
  // 총잔금은 이번 거래까지 반영된 현재 잔액이므로, 그 값에서 이번 거래 금액을 빼면 이번 거래 전까지의 잔액(전잔금)이 된다.
  const priorBalance = balance !== undefined ? balance - grandTotal : undefined;
  return { totalQuantity, supplyTotal, taxTotal, grandTotal, priorBalance };
}
