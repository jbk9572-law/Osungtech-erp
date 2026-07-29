import { InvoiceCopy } from "./InvoiceCopy";
import type { Company, InvoiceColor, InvoiceItem, CopyLabel } from "./types";

export type InvoiceCopies = "both" | "receiver" | "supplier";
export type InvoiceLayout = "half" | "full";

// 전지 모드(품목이 많은 날 한 부 전체를 A4 한 장에 꽉 채워 찍는 모드)에서
// 페이지당 담을 수 있는 최대 품목 줄 수. 실측 PDF가 있는 반절판(0707 원본)과
// 달리 전지판은 별도 실측 대조본이 없어, 남은 페이지 높이(A4 - 상하 여백 -
// 머리글/공급자·공급받는자칸/합계칸/꼬리말)를 줄 높이(24px)로 나눠 넉넉히
// 잡은 값이다. 실제 인쇄해보고 여백이 남거나 넘치면 이 숫자만 조정하면 된다.
const FULL_LAYOUT_ITEMS_PER_PAGE = 20;

function chunkItems<T>(items: T[], size: number): T[][] {
  if (items.length === 0) return [[]];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

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
  layout = "half",
}: {
  company: Company;
  customerName: string;
  orderDate: string;
  docNumber: string;
  items: InvoiceItem[];
  memo?: string | null;
  copies?: InvoiceCopies;
  layout?: InvoiceLayout;
}) {
  const showReceiver = copies === "both" || copies === "receiver";
  const showSupplier = copies === "both" || copies === "supplier";

  if (layout === "full") {
    const copyConfigs: { copyLabel: CopyLabel; color: InvoiceColor }[] = [
      ...(showReceiver ? [{ copyLabel: "공급받는자 보관용" as const, color: "blue" as const }] : []),
      ...(showSupplier ? [{ copyLabel: "공급자 보관용" as const, color: "red" as const }] : []),
    ];
    const pages = copyConfigs.flatMap(({ copyLabel, color }) => {
      const chunks = chunkItems(items, FULL_LAYOUT_ITEMS_PER_PAGE);
      return chunks.map((pageItems, i) => ({
        copyLabel,
        color,
        pageItems,
        pageIndex: i + 1,
        pageCount: chunks.length,
        isLastPage: i === chunks.length - 1,
      }));
    });

    return (
      <div className="overflow-x-auto">
        {pages.map((p, i) => (
          <div
            key={`${p.copyLabel}-${p.pageIndex}`}
            // print-page-wrapper 여백은 각 장이 통째로 한 페이지이므로(중간에
            // 쪼개지지 않으므로) 여기 개별 장 단위로 줘야 상하 여백이 페이지마다
            // 온전히 적용된다 — 바깥 컨테이너 하나에 주면 인쇄 시 여러 페이지로
            // 나뉠 때 위/아래 여백이 첫 장/마지막 장에만 적용되는 문제가 있다.
            className={`print-page-wrapper${i < pages.length - 1 ? " print-page-break" : ""}`}
          >
            <InvoiceCopy
              copyLabel={p.copyLabel}
              color={p.color}
              company={company}
              customerName={customerName}
              orderDate={orderDate}
              docNumber={docNumber}
              items={p.pageItems}
              summaryItems={items}
              memo={memo}
              minItemRows={FULL_LAYOUT_ITEMS_PER_PAGE}
              pageIndex={p.pageIndex}
              pageCount={p.pageCount}
              showSummary={p.isLastPage}
            />
          </div>
        ))}
      </div>
    );
  }

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
