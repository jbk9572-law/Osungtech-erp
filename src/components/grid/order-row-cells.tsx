import type { CSSProperties } from "react";
import { GridBadge } from "@/components/grid/badge";
import { formatCarryoverDate } from "@/lib/carryover";
import { rowDay } from "@/lib/row-day";

// 매출/매입 목록 표(sales-grid-table / purchase-grid-table)가 글자 그대로 똑같이 들고 있던
// 날짜·과세구분·배송방법 칸. 두 표가 같은 모양을 유지하도록 한 곳에서 그린다.
// 칸 너비/고정 스타일(sticky 등)은 호출한 표가 style로 넘긴다.

export function OrderDateCell({
  date,
  compact,
  isCarryover,
  style,
}: {
  date: string | null | undefined;
  // 이월/예약 줄처럼 "MM.DD" 짧은 날짜로 보여줄지(compactDate 옵션)
  compact: boolean;
  isCarryover: boolean;
  style: CSSProperties | undefined;
}) {
  return (
    <td style={style}>
      {date
        ? compact || rowDay(date) === "future"
          ? formatCarryoverDate(date)
          : new Date(date).toLocaleDateString("ko-KR")
        : "-"}
      {isCarryover && date && (
        <GridBadge tone="warn" style={{ marginLeft: 4 }}>
          이월
        </GridBadge>
      )}
      {rowDay(date) === "future" && (
        <GridBadge tone="muted" style={{ marginLeft: 4 }}>
          예약
        </GridBadge>
      )}
    </td>
  );
}

export function TaxTypeCell({ taxType, style }: { taxType: string | null | undefined; style: CSSProperties | undefined }) {
  return (
    <td style={style}>
      {taxType ? (
        <GridBadge tone={taxType === "과세" ? "info" : taxType === "영세" ? "warn" : "muted"}>{taxType}</GridBadge>
      ) : (
        "-"
      )}
    </td>
  );
}

export function DeliveryMethodCell({
  deliveryMethod,
  style,
}: {
  deliveryMethod: string | null | undefined;
  style: CSSProperties | undefined;
}) {
  return (
    <td style={style}>
      {deliveryMethod ? <GridBadge tone="muted">{deliveryMethod}</GridBadge> : <span className="erp-u-muted">-</span>}
    </td>
  );
}
