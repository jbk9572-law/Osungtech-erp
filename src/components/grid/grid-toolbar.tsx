import type { ReactNode } from "react";

// 가로형 표(매출/매입) 바로 위 도구줄 — 왼쪽에 "몇 줄 표시 중 · 몇 건 선택", 오른쪽에 도구 버튼(컬럼 설정 등).
// 예전엔 컬럼 설정 버튼 하나만 오른쪽 끝에 혼자 떠 있어서 다른 줄과 어울리지 않았다 — 표 머리말처럼
// 정보가 있는 한 줄로 만들어 버튼이 그 줄의 일부로 읽히게 하고, 매출/매입이 같은 모양을 쓰게 한다.
export function GridToolbar({
  total,
  selectedCount,
  children,
}: {
  total: number;
  selectedCount: number;
  children?: ReactNode;
}) {
  return (
    <div className="erp-grid-toolbar">
      <span className="erp-grid-toolbar-info">
        {total.toLocaleString("ko-KR")}줄 표시 중{selectedCount > 0 ? ` · ${selectedCount.toLocaleString("ko-KR")}건 선택` : ""}
      </span>
      <span className="erp-grid-toolbar-actions">{children}</span>
    </div>
  );
}
