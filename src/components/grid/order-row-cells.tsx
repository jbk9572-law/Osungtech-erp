import { formatKstDate } from "@/lib/kst-date";
import type { CSSProperties } from "react";
import { GridBadge } from "@/components/grid/badge";
import { formatCarryoverDate, nextMonthLabel, usesShortDate } from "@/lib/carryover";
import { rowDay } from "@/lib/row-day";

// 매출/매입 목록 표(sales-grid-table / purchase-grid-table)가 글자 그대로 똑같이 들고 있던
// 날짜·과세구분·배송방법 칸. 두 표가 같은 모양을 유지하도록 한 곳에서 그린다.
// 칸 너비/고정 스타일(sticky 등)은 호출한 표가 style로 넘긴다.

// 이월 뱃지 — 글자는 항상 "이월" 하나다. 어느 종류인지는 색(전월에서 넘어온 건 = 호박색, 다음 달로 넘기는 건 = 연보라)과
// 앞의 날짜로 구분되므로 종류 이름을 따로 붙이지 않는다. 두 뱃지는 같은 모양(흰 바탕 알약+테두리)이라 행 배경과 같은 색 계열이어도
// 묻히지 않는다. 마우스를 올리면 설명이 나온다. 목록 표와 모바일 카드가 같이 쓴다.
export function CarryoverBadge({ date, fromPrevMonth }: { date: string; fromPrevMonth: boolean }) {
  return (
    <GridBadge
      tone={fromPrevMonth ? "carryPrev" : "carry"}
      style={{ marginLeft: 4 }}
      title={fromPrevMonth ? "전월에서 넘어와 이번 달 실적으로 잡히는 건" : `이번 달에 등록했지만 ${nextMonthLabel(date)} 실적으로 넘기는 건`}
    >
      이월
    </GridBadge>
  );
}

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
        ? usesShortDate({ compactSection: compact, isCarryover, isFuture: rowDay(date) === "future" })
          ? formatCarryoverDate(date)
          : formatKstDate(date)
        : "-"}
      {isCarryover && date && <CarryoverBadge date={date} fromPrevMonth={compact} />}
      {rowDay(date) === "future" && (
        <GridBadge tone="reserve" style={{ marginLeft: 4 }} title="미리 등록해 둔 예약 건(아직 오지 않은 날짜)">
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
