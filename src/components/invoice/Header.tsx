import { Cell } from "./Cell";
import { HEADER, TITLE } from "./InvoiceMetrics";
import { formatDate, type CopyLabel } from "./types";

// 0707 원본: "거래명세표" 제목 + "(공급받는자/보관용)" 보관용 라벨 + 일자/No/페이지.
export function Header({
  copyLabel,
  orderDate,
  docNumber,
}: {
  copyLabel: CopyLabel;
  orderDate: string;
  docNumber: string;
}) {
  return (
    <tr style={{ height: HEADER.rowHeight }}>
      <Cell
        colSpan={10}
        align="center"
        hideBorder={["r"]}
        style={{
          fontFamily: TITLE.fontFamily,
          fontSize: TITLE.fontSize,
          fontWeight: TITLE.fontWeight,
          letterSpacing: TITLE.letterSpacing,
        }}
      >
        거래명세표
      </Cell>
      <Cell
        colSpan={7}
        align="center"
        hideBorder={["l"]}
        className="font-medium"
        style={{ fontSize: HEADER.copyLabelFontSize }}
        wrap
      >
        ({copyLabel})
      </Cell>
      <Cell colSpan={3}>일자</Cell>
      <Cell colSpan={5}>{formatDate(orderDate)}</Cell>
      <Cell colSpan={2}>No</Cell>
      <Cell colSpan={5}>{docNumber}</Cell>
      <Cell colSpan={2} align="center">
        1/1
      </Cell>
    </tr>
  );
}
