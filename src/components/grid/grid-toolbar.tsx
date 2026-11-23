import type { ReactNode } from "react";

// 가로형 표(매출/매입) 바로 위 도구줄 — 왼쪽에 "몇 줄 표시 중 · 몇 건 선택", 오른쪽에 도구 버튼(열 설정 등).
// 예전엔 열 설정 버튼 하나만 오른쪽 끝에 혼자 떠 있어서 다른 줄과 어울리지 않았다 — 표 머리말처럼
// 정보가 있는 한 줄로 만들어 버튼이 그 줄의 일부로 읽히게 하고, 매출/매입이 같은 모양을 쓰게 한다.
export type GridStat = { label: string; value: string };

// stats: 조회 합계 요약(공급가액·세액·합계 등). 표시 여부는 테마 토큰(--erp-grid-stats-display) — 클래식은 숨김.
export function GridToolbar({
  total,
  selectedCount,
  stats,
  children,
}: {
  total: number;
  selectedCount: number;
  stats?: GridStat[];
  children?: ReactNode;
}) {
  return (
    <div className="erp-grid-toolbar">
      <span className="erp-grid-toolbar-info">
        {total.toLocaleString("ko-KR")}줄 표시 중{selectedCount > 0 ? ` · ${selectedCount.toLocaleString("ko-KR")}건 선택` : ""}
      </span>
      {stats && stats.length > 0 && (
        <span className="erp-grid-stats">
          {stats.map((s) => (
            <span key={s.label} className="erp-grid-stat">
              {s.label} <b>{s.value}</b>
            </span>
          ))}
        </span>
      )}
      <span className="erp-grid-toolbar-actions">{children}</span>
    </div>
  );
}
