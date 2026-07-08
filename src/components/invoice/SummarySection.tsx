import { Cell } from "./Cell";
import { DOCUMENT, SUMMARY } from "./InvoiceMetrics";
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
      <tr style={{ height: SUMMARY.totalRowHeight, fontSize: SUMMARY.labelFontSize }}>
        <Cell colSpan={2} className="font-semibold">
          <span style={{ position: "relative", left: SUMMARY.labelOffsetX }}>합계</span>
        </Cell>
        <Cell
          colSpan={24}
          className="text-black"
          hideBorder={["r"]}
          style={{ fontSize: DOCUMENT.baseFontSize }}
        >
          <div className="flex items-baseline justify-between">
            <span className="font-bold" style={{ position: "relative", left: SUMMARY.amountOffsetX }}>
              ￦{grandTotal.toLocaleString()}원정
            </span>
            <span
              className="text-right"
              style={{ position: "relative", left: SUMMARY.breakdownOffsetX, fontSize: SUMMARY.breakdownFontSize }}
            >
              (수량 : {totalQuantity.toLocaleString()}, 공급가 : {supplyTotal.toLocaleString()},
              세액 : {taxTotal.toLocaleString()})
            </span>
          </div>
        </Cell>
        <Cell
          colSpan={4}
          as="th"
          hideBorder={["l"]}
          style={{ fontSize: SUMMARY.balanceLabelFontSize, overflow: "visible", position: "relative" }}
        >
          <span
            aria-hidden
            className="absolute top-0 bottom-0 border-l border-[var(--invoice-line)]"
            style={{ left: SUMMARY.balanceLineOffsetX }}
          />
          <span style={{ position: "relative", left: SUMMARY.balanceLabelOffsetX }}>전잔금</span>
        </Cell>
        <Cell colSpan={4} />
      </tr>
      <tr style={{ height: SUMMARY.memoRowHeight, fontSize: SUMMARY.labelFontSize }}>
        <Cell colSpan={2}>
          <span style={{ position: "relative", left: SUMMARY.labelOffsetX }}>메모</span>
        </Cell>
        <Cell colSpan={24} className="opacity-80" hideBorder={["r"]} style={{ fontSize: DOCUMENT.baseFontSize }}>
          {memo || ""}
        </Cell>
        <Cell
          colSpan={4}
          as="th"
          hideBorder={["l"]}
          style={{ fontSize: SUMMARY.balanceLabelFontSize, overflow: "visible", position: "relative" }}
        >
          <span
            aria-hidden
            className="absolute top-0 bottom-0 border-l border-[var(--invoice-line)]"
            style={{ left: SUMMARY.balanceLineOffsetX }}
          />
          <span style={{ position: "relative", left: SUMMARY.balanceLabelOffsetX }}>총잔금</span>
        </Cell>
        <Cell colSpan={4} />
      </tr>
    </>
  );
}
