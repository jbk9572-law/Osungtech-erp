"use client";

import { useThemeFeatures } from "@/lib/erp-theme-features";

// 표 머리글 위에 얹는 "묶음 머리글" 줄(예: 공급가액·세액 위의 "금액(원)") — 테마 기능 groupedHeader가 켜졌을 때만 그린다.
// 숨겨진 칸(컬럼 설정)도 DOM에는 남아 있으므로 칸 수(before/span/after)는 고정 값이다 — 아래 머리글 줄의 th 개수와 맞춘다.
// 매출/매입 목록이 같이 쓴다.
export function GridGroupHeaderRow({
  before,
  span,
  after,
  label,
}: {
  before: number;
  span: number;
  after: number;
  label: string;
}) {
  const { groupedHeader } = useThemeFeatures();
  if (!groupedHeader) return null;
  return (
    <tr className="erp-grid-group-row">
      <th colSpan={before} aria-hidden="true" />
      <th colSpan={span} className="erp-grid-group-label">
        {label}
      </th>
      <th colSpan={after} aria-hidden="true" />
    </tr>
  );
}
