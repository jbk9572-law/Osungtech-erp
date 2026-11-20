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

// minWidth: 표가 container보다 넓을 때 브라우저(table-layout: auto)가 칸을 선언한 폭보다 좁게 줄이면, 뒤따르는 고정 칸의 left(앞 칸 폭의 합)와
// 실제 칸 위치가 어긋나 두 고정 칸 사이에 행 색이 가는 띠로 비치고 칸이 서로 겹친다(매입/매출 목록의 "날짜 칸 앞 미세한 색 구분").
// 선언한 폭 아래로는 줄지 않게 못박는다.
export function stickyHeaderStyle(left: number, width: number, extra?: CSSProperties): CSSProperties {
  return { ...stickyBase, left, width, minWidth: width, background: "var(--erp-bg)", zIndex: 2, ...extra };
}

// 배경: 고정 칸은 옆으로 스크롤되는 칸을 가려야 해서 불투명해야 한다 — 그래서 투명 대신 "행의 현재 배경색"(--erp-row-bg)을 쓴다.
// 줄무늬·마우스 올림·선택·펼침(erp-theme.css)이 행 상태마다 --erp-row-bg를 같이 바꿔 주므로, 고정 칸도 나머지 칸과 같은 색이 된다
// (예전엔 항상 패널 흰색이라 행을 눌러도 날짜 칸만 흰색으로 남았다). 이월·오늘·예약 행은 기존대로 !important 규칙이 따로 덮는다.
export function stickyCellStyle(left: number, width: number, extra?: CSSProperties): CSSProperties {
  return { ...stickyBase, left, width, minWidth: width, background: "var(--erp-row-bg, var(--erp-panel))", ...extra };
}

// 매출/매입 그리드의 합계(tfoot) 행에서 스크롤해도 붙어있어야 하는 칸들 —
// colSpan으로 폭을 정하는 칸이라 width는 지정하지 않는다.
export function stickyFooterStyle(left: number, extra?: CSSProperties): CSSProperties {
  return { ...stickyBase, left, background: "var(--erp-bg)", ...extra };
}
