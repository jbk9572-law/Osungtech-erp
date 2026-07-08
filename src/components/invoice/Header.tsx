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
          overflow: "visible",
        }}
      >
        <span style={{ position: "relative", left: TITLE.offsetX, top: TITLE.offsetY }}>거래명세표</span>
      </Cell>
      <Cell
        colSpan={7}
        align="center"
        valign="top"
        hideBorder={["l"]}
        className="font-medium"
        style={{ fontSize: HEADER.copyLabelFontSize, paddingTop: HEADER.dateRowTopPadding, overflow: "visible" }}
        wrap
      >
        <span style={{ position: "relative", left: HEADER.copyLabelOffsetX }}>
          ({copyLabel.split(" ")[0]}
          <br />
          {copyLabel.split(" ")[1]})
        </span>
      </Cell>
      <Cell
        colSpan={3}
        valign="top"
        style={{ paddingTop: HEADER.dateRowTopPadding, position: "relative" }}
      >
        일자
        <span
          aria-hidden
          className="absolute left-0 right-0 border-t border-[var(--invoice-line)]"
          style={{ top: HEADER.dateRowLineOffsetY }}
        />
      </Cell>
      <Cell
        colSpan={5}
        valign="top"
        style={{ paddingTop: HEADER.dateRowTopPadding, position: "relative" }}
      >
        {formatDate(orderDate)}
        <span
          aria-hidden
          className="absolute left-0 right-0 border-t border-[var(--invoice-line)]"
          style={{ top: HEADER.dateRowLineOffsetY }}
        />
      </Cell>
      <Cell
        colSpan={1}
        valign="top"
        hideBorder={["r"]}
        style={{ paddingTop: HEADER.dateRowTopPadding, position: "relative" }}
      >
        No
        <span
          aria-hidden
          className="absolute left-0 right-0 border-t border-[var(--invoice-line)]"
          style={{ top: HEADER.dateRowLineOffsetY }}
        />
      </Cell>
      <Cell
        colSpan={6}
        valign="top"
        hideBorder={["l"]}
        style={{ paddingTop: HEADER.dateRowTopPadding, overflow: "visible", position: "relative" }}
      >
        <span
          aria-hidden
          className="absolute top-0 bottom-0 border-l border-[var(--invoice-line)]"
          style={{ left: HEADER.docNumberLineOffsetX }}
        />
        <span style={{ position: "relative", left: HEADER.docNumberOffsetX }}>{docNumber}</span>
        <span
          aria-hidden
          className="absolute left-0 right-0 border-t border-[var(--invoice-line)]"
          style={{ top: HEADER.dateRowLineOffsetY }}
        />
      </Cell>
      <Cell colSpan={2} align="center" valign="top" style={{ paddingTop: HEADER.dateRowTopPadding }}>
        1/1
      </Cell>
    </tr>
  );
}
