import type { CSSProperties } from "react";

// 그리드 첫 칸(들)을 옆으로 스크롤해도 항상 보이게 고정하는 스타일을
// 한 곳에서 만든다 — 매출/매입/상품 그리드가 각자 STICKY_1_WIDTH 같은
// 이름의 상수를 따로 선언해뒀는데 실제 값이 서로 달라서(32 vs 90 등)
// 이름만 같고 공유는 안 되는 상태였다. 거래처/공급처 그리드는 아예
// 스티키 자체가 없었다.
export const GRID_CHECKBOX_WIDTH = 32;

const stickyBase: CSSProperties = { position: "sticky", zIndex: 1 };

export function stickyHeaderStyle(left: number, width: number, extra?: CSSProperties): CSSProperties {
  return { ...stickyBase, left, width, background: "var(--erp-bg)", zIndex: 2, ...extra };
}

export function stickyCellStyle(left: number, width: number, extra?: CSSProperties): CSSProperties {
  return { ...stickyBase, left, width, background: "#fff", ...extra };
}

// 매출/매입 그리드의 합계(tfoot) 행에서 스크롤해도 붙어있어야 하는 칸들 —
// colSpan으로 폭을 정하는 칸이라 width는 지정하지 않는다.
export function stickyFooterStyle(left: number, extra?: CSSProperties): CSSProperties {
  return { ...stickyBase, left, background: "var(--erp-bg)", ...extra };
}
