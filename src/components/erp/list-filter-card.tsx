import type { ReactNode } from "react";

// 목록 위 조회 조건(기간 바로가기 칩 + 기간·검색 폼)을 박스 하나로 묶는다 — 칩 줄과 폼이 따로 떠 있던 것(번잡)을 한 덩어리로(개발헌법 3번).
// 견적서·구매요청·구매 견적요청·영업활동이 같이 쓴다. 안의 폼은 자기 테두리를 갖지 않는다(CSS가 벗긴다).
export function ListFilterCard({ children }: { children: ReactNode }) {
  return <div className="erp-filter-card">{children}</div>;
}
