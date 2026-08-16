"use client";

import type { CSSProperties, ReactNode } from "react";

// 정렬 가능한 헤더 칸의 마크업(th + aria-sort + 버튼)을 한 곳에서만
// 관리한다 — 예전엔 거래처/공급처 그리드가 <th onClick> 방식이라 정렬
// 가능한지 스크린리더로 알 수 없었고(aria-sort 없음), 매출/매입/상품
// 그리드만 <button className="erp-th-btn"> 방식으로 따로 구현돼 있었다.
export function SortableTh({
  label,
  ariaSortValue,
  onClick,
  style,
  className,
}: {
  label: ReactNode;
  ariaSortValue: "ascending" | "descending" | "none";
  onClick: () => void;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <th className={className} style={style} aria-sort={ariaSortValue}>
      <button type="button" onClick={onClick} className="erp-th-btn">
        {label}
      </button>
    </th>
  );
}
