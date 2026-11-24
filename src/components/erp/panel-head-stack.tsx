import type { ReactNode } from "react";

// 패널(목록 칸·카드) 맨 위의 "머리 묶음" — 첫 줄(제목·탭·버튼)과 둘째 줄(칩·검색 등)을 한 덩어리로 쌓는다.
// 줄마다 안쪽 여백이 같고(--erp-space-3/4), 줄 사이는 여백뿐, 묶음 아래에만 구분선 하나 — 줄마다 높이·테두리를 따로 정하던 것이 겹치고 붙던 원인이었다(개발헌법 3번).
// 메신저 채팅방 목록, 할일 목록처럼 "머리 줄 + 보조 줄"이 있는 목록 칸이 같이 쓴다.
export function PanelHeadStack({ head, sub }: { head: ReactNode; sub?: ReactNode }) {
  return (
    <div className="erp-head-stack">
      <div className="erp-head-row">{head}</div>
      {sub && <div className="erp-head-row is-sub">{sub}</div>}
    </div>
  );
}
