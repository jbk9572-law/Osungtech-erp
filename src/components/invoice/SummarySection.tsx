import { Cell } from "./Cell";
import type { InvoiceItem } from "./types";

export function SummarySection({ items, memo }: { items: InvoiceItem[]; memo?: string | null }) {
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const supplyTotal = items.reduce((sum, item) => sum + item.supplyAmount, 0);
  const taxTotal = items.reduce((sum, item) => sum + item.taxAmount, 0);
  const grandTotal = supplyTotal + taxTotal;

  return (
    <>
      {/* 합계: "₩1,234원정 (수량 : x, 공급가 : y, 세액 : z)" 형태. 전잔금/총잔금은 인수자 칸과 세로로 맞추고 뒤에 한 칸 비워둔다 */}
      <tr className="h-[27px]">
        <Cell colSpan={2} className="font-semibold">
          합계
        </Cell>
        <Cell colSpan={24} className="text-black">
          <div className="flex items-baseline justify-between">
            <span className="font-bold">₩{grandTotal.toLocaleString()}원정</span>
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
      {/* 메모 */}
      <tr className="h-[30px]">
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
