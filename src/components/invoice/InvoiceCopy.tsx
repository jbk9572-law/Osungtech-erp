import { Header } from "./Header";
import { SupplierSection } from "./SupplierSection";
import { CustomerSection } from "./CustomerSection";
import { ItemsTable } from "./ItemsTable";
import { SummarySection } from "./SummarySection";
import { Footer } from "./Footer";
import { COL_WIDTHS, COLOR_HEX, type Company, type CopyLabel, type InvoiceColor, type InvoiceItem } from "./types";

// 엔택스 B형 서식 한 부(공급받는자용 또는 공급자용 한 장)를 그대로 재현한다.
// 원본 실측 PDF와 대조해 확정한 레이아웃이므로 임의로 여백/폰트/줄바꿈을
// 바꾸지 않는다.
export function InvoiceCopy({
  copyLabel,
  color,
  company,
  customerName,
  orderDate,
  docNumber,
  items,
  memo,
}: {
  copyLabel: CopyLabel;
  color: InvoiceColor;
  company: Company;
  customerName: string;
  orderDate: string;
  docNumber: string;
  items: InvoiceItem[];
  memo?: string | null;
}) {
  const colorStyle = { color: COLOR_HEX[color], "--invoice-line": COLOR_HEX[color] } as React.CSSProperties;

  return (
    <div className="break-inside-avoid" style={colorStyle}>
      <table className="w-full table-fixed border-collapse text-[13px] leading-tight">
        <colgroup>
          {COL_WIDTHS.map((w, i) => (
            <col key={i} style={{ width: `${w}%` }} />
          ))}
        </colgroup>
        <tbody>
          <Header copyLabel={copyLabel} orderDate={orderDate} docNumber={docNumber} />
          <SupplierSection company={company} customerSlot={<CustomerSection customerName={customerName} />} />
          <ItemsTable items={items} color={color} />
          <SummarySection items={items} memo={memo} />
        </tbody>
      </table>
      <Footer company={company} />
    </div>
  );
}
