import type { ReactNode } from "react";
import { formatNumber } from "@/lib/format-number";

// 표 박스 맨 아래에 붙는 "마감 줄" — 총(또는 불러온) 건수·선택 건수 + 선택적 합계. 행이 적어 박스 아래가 비어도 이 줄이 박스를 마감한다(.erp-master-detail-main 안, 표 박스 바로 뒤).
// partial: "더보기"로 일부만 불러온 목록이면 "불러온 N건"으로 적는다 — 전체가 아닌데 "총"이라고 하면 합계를 전체로 오해한다.
export function GridFootBar({
  count,
  selected,
  unit = "건",
  partial,
  sumLabel,
  sumValue,
}: {
  count: number;
  selected: number;
  unit?: string;
  partial?: boolean;
  sumLabel?: ReactNode;
  sumValue?: number;
}) {
  return (
    <div className="erp-grid-foot">
      <span>
        {partial ? "불러온" : "총"} <b>{formatNumber(count)}{unit}</b> · 선택 <b>{formatNumber(selected)}{unit}</b>
      </span>
      {sumLabel != null && sumValue != null && (
        <span>
          {partial ? "불러온 건 " : ""}
          {sumLabel} <b>{formatNumber(sumValue)}</b>
        </span>
      )}
    </div>
  );
}
