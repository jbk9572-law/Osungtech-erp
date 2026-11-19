// 행 색 범례 — 오늘/전월 이월/익월 이월/예약 행이 왜 그 색인지 표 위에서 바로 알려준다.
// 색은 행 규칙(.erp-grid tr.day-today 등)과 같은 토큰을 쓰므로 테마가 바뀌어도 어긋나지 않는다.
// 표시 여부는 테마 토큰(--erp-grid-legend-display)이 정한다 — 클래식은 숨김.
// rowDayClass/carryoverRowClass를 쓰는 목록(매출/매입/거래처 주문)은 이 컴포넌트를 같이 둔다.
export function GridRowLegend() {
  return (
    <div className="erp-grid-legend" aria-label="행 색 안내">
      <span className="erp-grid-legend-title">행 색</span>
      <span className="erp-grid-legend-item erp-legend-today">오늘</span>
      <span className="erp-grid-legend-item erp-legend-carry-prev">전월 이월</span>
      <span className="erp-grid-legend-item erp-legend-carry-next">익월 이월</span>
      <span className="erp-grid-legend-item erp-legend-future">예약</span>
    </div>
  );
}
