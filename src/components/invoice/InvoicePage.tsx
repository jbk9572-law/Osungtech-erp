import { InvoiceCopy } from "./InvoiceCopy";
import type { Company, InvoiceItem } from "./types";

export type InvoiceCopies = "both" | "receiver" | "supplier";

// 0707 원본: 한 페이지에 공급받는자 보관용(위) + 공급자 보관용(아래) 두 부가
// 절취선으로 나뉘어 인쇄된다. 두 부는 완전히 같은 컴포넌트(InvoiceCopy)를
// props(copyLabel/color)만 바꿔 재사용한다 — 레이아웃을 복제하지 않는다.
export function InvoicePage({
  company,
  customerName,
  orderDate,
  docNumber,
  items,
  memo,
  copies = "both",
}: {
  company: Company;
  customerName: string;
  orderDate: string;
  docNumber: string;
  items: InvoiceItem[];
  memo?: string | null;
  copies?: InvoiceCopies;
}) {
  const showReceiver = copies === "both" || copies === "receiver";
  const showSupplier = copies === "both" || copies === "supplier";

  return (
    <div className="overflow-x-auto break-inside-avoid">
      {showReceiver && (
        <InvoiceCopy
          copyLabel="공급받는자 보관용"
          color="blue"
          company={company}
          customerName={customerName}
          orderDate={orderDate}
          docNumber={docNumber}
          items={items}
          memo={memo}
        />
      )}
      {showReceiver && showSupplier && <CutLine />}
      {showSupplier && (
        <InvoiceCopy
          copyLabel="공급자 보관용"
          color="red"
          company={company}
          customerName={customerName}
          orderDate={orderDate}
          docNumber={docNumber}
          items={items}
          memo={memo}
        />
      )}
    </div>
  );
}

function CutLine() {
  return (
    <div className="my-2 flex items-center gap-2 text-[11px] text-gray-400">
      <span className="flex-1 border-t border-dashed border-gray-400" />
      <span>✂ 절취선 ✂</span>
      <span className="flex-1 border-t border-dashed border-gray-400" />
    </div>
  );
}
