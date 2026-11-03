import type { CSSProperties } from "react";

// 그리드 첫 칸(들)을 옆으로 스크롤해도 항상 보이게 고정하는 스타일을
// 한 곳에서 만든다 — 매출/매입/상품 그리드가 각자 STICKY_1_WIDTH 같은
// 이름의 상수를 따로 선언해뒀는데 실제 값이 서로 달라서(32 vs 90 등)
// 이름만 같고 공유는 안 되는 상태였다. 거래처/공급처 그리드는 아예
// 스티키 자체가 없었다.
export const GRID_CHECKBOX_WIDTH = 32;

// 표 맨 끝 "상세보기/명세표" 아이콘 칸 — 너비를 안 주면 table-layout:
// auto 특성상 남는 공간이 전부 이 빈 칸(<th />)으로 몰려서, 컬럼 설정에서
// 칸을 하나 꺼 숨길 때마다 그만큼의 여백이 표 맨 오른쪽에 빈 블록으로
// 나타나는 버그가 있었다(매출/매입 그리드 둘 다 같은 구조라 같은 증상 —
// 사용자 지적: "저게뭐야 우측끝에"). 아이콘 2개(26px+2px gap+26px) +
// 좌우 패딩(10px×2)을 담을 만큼만 고정폭을 줘서 더 이상 여유 공간을
// 흡수하지 않게 한다.
export const GRID_ACTION_COL_WIDTH = 74;

const stickyBase: CSSProperties = { position: "sticky", zIndex: 1 };

export function stickyHeaderStyle(left: number, width: number, extra?: CSSProperties): CSSProperties {
  return { ...stickyBase, left, width, background: "var(--erp-bg)", zIndex: 2, ...extra };
}

export function stickyCellStyle(left: number, width: number, extra?: CSSProperties): CSSProperties {
  return { ...stickyBase, left, width, background: "var(--erp-panel)", ...extra };
}

// 매출/매입 그리드의 합계(tfoot) 행에서 스크롤해도 붙어있어야 하는 칸들 —
// colSpan으로 폭을 정하는 칸이라 width는 지정하지 않는다.
export function stickyFooterStyle(left: number, extra?: CSSProperties): CSSProperties {
  return { ...stickyBase, left, background: "var(--erp-bg)", ...extra };
}
