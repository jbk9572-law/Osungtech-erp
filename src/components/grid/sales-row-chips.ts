import type { SalesRow } from "@/components/sales-grid-table";
import { orderSelectionChips } from "@/lib/order-selection-chips";

// 매출 목록 한 줄 → 오른쪽 상세 패널의 색 칩·강조색. 칩 규칙 자체는 order-selection-chips.ts(매입 목록과 공용)이고,
// 여기는 매출 줄의 값(수금/반품/샘플, 과세구분, 수금 상태, 계산서 발행, 이월)을 그 규칙에 넘기는 얇은 변환이다.
export function salesRowChips(row: SalesRow) {
  return orderSelectionChips({
    kindLabel: row.kind === "collection" ? "수금" : row.isReturn ? "반품" : row.isSample ? "샘플" : "매출",
    kindTone: row.kind === "collection" ? "ok" : row.isReturn ? "danger" : row.isSample ? "carry" : "info",
    taxType: row.taxType,
    paymentStatus: row.paymentStatus,
    paymentLabels: { paid: "수금완료", partial: "일부수금", unpaid: "미수" },
    skipPayment: row.kind === "collection",
    invoiceLabel: row.invoiceStatus === "issued" ? "계산서 발행" : null,
    isCarryover: row.isCarryover,
    isReturn: row.isReturn,
  });
}
