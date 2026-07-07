import { Cell } from "./Cell";
import { SUMMARY } from "./InvoiceMetrics";
import type { InvoiceItem } from "./types";

// 0707 원본: "합계 ₩1,265,000원정 (수량 : 10,000, 공급가 : 1,150,000, 세액 : 115,000)"
// + 전잔금/총잔금(원본에는 값 없이 빈 칸) + 메모.
export function SummarySection({ items, memo }: { items: InvoiceItem[]; memo?: string | null }) {
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const supplyTotal = items.reduce((sum, item) => sum + item.supplyAmount, 0);
  const taxTotal = items.reduce((sum, item) => sum + item.taxAmount, 0);
  const grandTotal = supplyTotal + taxTotal;

  return (
    <>
      <tr style={{ height: SUMMARY.totalRowHeight }}>
        <Cell colSpan={2} className="font-semibold">
          합계
        </Cell>
        <Cell colSpan={24} className="text-black">
          <div className="flex items-baseline justify-between">
            <span className="font-bold">￦{grandTotal.toLocaleString()}원정</span>
            <span className="text-right">
              (수량 : {totalQuantity.toLocaleString()}, 공급가 : {supplyTotal.toLocaleString()},
              세액 : {taxTotal.toLocaleString()})
            </span>
          </div>
        </Cell>
        <Cell colSpan={4} as="th">
          전잔금
        </Cell>
        <Cell colSpan={4} />
      </tr>
      <tr style={{ height: SUMMARY.memoRowHeight }}>
        <Cell colSpan={2}>메모</Cell>
        <Cell colSpan={24} className="opacity-80">
          {memo || ""}
        </Cell>
        <Cell colSpan={4} as="th">
          총잔금
        </Cell>
        <Cell colSpan={4} />
      </tr>
    </>
  );
}
