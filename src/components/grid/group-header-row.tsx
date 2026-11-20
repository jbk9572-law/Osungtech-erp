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
  groups,
}: {
  before: number;
  span?: number;
  after?: number;
  label?: string;
  /** 묶음이 여러 개일 때(예: 거래처 | 미수금 | 거래) — 이 목록을 주면 span/label/after 대신 이걸 그린다. 맨 앞 빈 칸 수는 before. */
  groups?: { span: number; label: string }[];
}) {
  const { groupedHeader } = useThemeFeatures();
  if (!groupedHeader) return null;
  const list = groups ?? [{ span: span ?? 1, label: label ?? "" }];
  return (
    <tr className="erp-grid-group-row">
      {before > 0 && <th colSpan={before} aria-hidden="true" />}
      {list.map((g) => (
        <th key={g.label} colSpan={g.span} className="erp-grid-group-label">
          {g.label}
        </th>
      ))}
      {!!after && <th colSpan={after} aria-hidden="true" />}
    </tr>
  );
}
