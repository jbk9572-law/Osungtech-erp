import { Header } from "./Header";
import { SupplierSection } from "./SupplierSection";
import { CustomerSection } from "./CustomerSection";
import { ItemsTable } from "./ItemsTable";
import { SummarySection } from "./SummarySection";
import { Footer } from "./Footer";
import { DOCUMENT, SEAL } from "./InvoiceMetrics";
import { COL_WIDTHS, COLOR_HEX, type Company, type CopyLabel, type InvoiceColor, type InvoiceItem } from "./types";

// 0707 원본(엔택스 B형 서식) 한 부(공급받는자용 또는 공급자용 한 장)를 그대로
// 재현한다. 원본 실측 PDF와 대조해 확정한 레이아웃이므로 임의로
// 여백/폰트/줄바꿈을 바꾸지 않는다.
export function InvoiceCopy({
  copyLabel,
  color,
  company,
  customerName,
  orderDate,
  docNumber,
  items,
  memo,
  minItemRows = 10,
  itemRowHeight,
  pageIndex = 1,
  pageCount = 1,
  showSummary = true,
  summaryItems,
  balance,
}: {
  copyLabel: CopyLabel;
  color: InvoiceColor;
  company: Company;
  customerName: string;
  orderDate: string;
  docNumber: string;
  items: InvoiceItem[];
  memo?: string | null;
  // 전지 모드에서 품목이 페이지당 용량을 넘으면 여러 장으로 나뉜다. 이때
  // 이 장에 실제로 찍히는 품목(items)과 합계 계산에 쓰이는 전체 품목
  // (summaryItems)이 달라지므로 따로 받는다 — 2연식(한 장짜리)에서는
  // 항상 같으므로 생략하면 items를 그대로 쓴다.
  minItemRows?: number;
  itemRowHeight?: number;
  pageIndex?: number;
  pageCount?: number;
  showSummary?: boolean;
  summaryItems?: InvoiceItem[];
  balance?: number;
}) {
  const colorStyle = { color: COLOR_HEX[color], "--invoice-line": COLOR_HEX[color] } as React.CSSProperties;

  return (
    <div className="relative break-inside-avoid" style={colorStyle}>
      <table
        className="w-full table-fixed border-collapse leading-tight"
        style={{ fontSize: DOCUMENT.baseFontSize }}
      >
        <colgroup>
          {COL_WIDTHS.map((w, i) => (
            <col key={i} style={{ width: `${w}%` }} />
          ))}
        </colgroup>
        <tbody>
          <Header
            copyLabel={copyLabel}
            orderDate={orderDate}
            docNumber={docNumber}
            pageIndex={pageIndex}
            pageCount={pageCount}
          />
          <SupplierSection company={company} customerSlot={<CustomerSection customerName={customerName} />} />
          <ItemsTable items={items} color={color} minItemRows={minItemRows} itemRowHeight={itemRowHeight} />
          {showSummary && <SummarySection items={summaryItems ?? items} memo={memo} balance={balance} />}
        </tbody>
      </table>
      {/* 도장: 0707 원본에서 셀 경계에 갇히지 않고 종사업장/상호/주소 행 경계를
          가로질러 겹쳐 찍힌다. 표 내부 셀이 아니라 표 전체를 기준으로 절대
          위치시켜 셀의 overflow-hidden에 잘리지 않게 한다 (원본 실측: 표
          상단에서 58px 지점, 좌측에서 43.5% 지점을 중심으로 겹침). */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={company?.seal_image_url || "/branding/company-seal.png"}
        alt=""
        aria-hidden
        className="pointer-events-none absolute -translate-x-1/2 opacity-90 mix-blend-multiply"
        style={{ top: SEAL.top, left: SEAL.left, height: SEAL.size, width: SEAL.size }}
      />
      <Footer company={company} />
    </div>
  );
}
