import { InvoiceCopy } from "./InvoiceCopy";
import type { Company, InvoiceItem } from "./types";

export type InvoiceCopies = "both" | "receiver" | "supplier";

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
