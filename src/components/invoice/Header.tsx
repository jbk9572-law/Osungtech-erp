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
      {/* 0707 원본 실측: 일자/날짜/No/문서번호/1-1 사이 세로 구분선은 위쪽
          절반(가로선 위)에서만 존재하고, 가로선 아래는 칸 구분 없이 하나로
          뚫린 빈 공간이다. 테이블 셀 테두리는 항상 셀 전체 높이로만 그려지므로
          기본 테두리는 전부 숨기고, 위쪽 절반 높이만큼만 커스텀 세로선을
          그려 이 구조를 재현한다. */}
      <Cell
        colSpan={3}
        valign="top"
        hideBorder={["r"]}
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
        hideBorder={["l", "r"]}
        style={{ paddingTop: HEADER.dateRowTopPadding, position: "relative" }}
      >
        <span
          aria-hidden
          className="absolute top-0 border-l border-[var(--invoice-line)]"
          style={{ height: HEADER.dateRowLineOffsetY }}
        />
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
        hideBorder={["l", "r"]}
        style={{ paddingTop: HEADER.dateRowTopPadding, position: "relative" }}
      >
        <span
          aria-hidden
          className="absolute top-0 border-l border-[var(--invoice-line)]"
          style={{ height: HEADER.dateRowLineOffsetY }}
        />
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
        hideBorder={["l", "r"]}
        style={{ paddingTop: HEADER.dateRowTopPadding, overflow: "visible", position: "relative" }}
      >
        <span
          aria-hidden
          className="absolute top-0 border-l border-[var(--invoice-line)]"
          style={{ left: HEADER.docNumberLineOffsetX, height: HEADER.dateRowLineOffsetY }}
        />
        <span style={{ position: "relative", left: HEADER.docNumberOffsetX }}>{docNumber}</span>
        <span
          aria-hidden
          className="absolute left-0 right-0 border-t border-[var(--invoice-line)]"
          style={{ top: HEADER.dateRowLineOffsetY }}
        />
      </Cell>
      <Cell
        colSpan={2}
        align="center"
        valign="top"
        hideBorder={["l"]}
        style={{ paddingTop: HEADER.dateRowTopPadding, position: "relative" }}
      >
        <span
          aria-hidden
          className="absolute top-0 border-l border-[var(--invoice-line)]"
          style={{ height: HEADER.dateRowLineOffsetY }}
        />
        1/1
      </Cell>
    </tr>
  );
}
