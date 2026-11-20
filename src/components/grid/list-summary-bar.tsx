// 목록 위 한 줄 요약(예: "총 24건 · 내 차례 2건") — 표 위 도구줄(.erp-grid-toolbar)과 같은 모양을 쓴다.
// 표시 여부는 테마 토큰(--erp-grid-stats-display)이라 클래식은 숨겨진다. 전자결재·권한관리 같은 서버 화면이 같이 쓴다.
export type ListSummaryItem = { label: string; value: string };

export function ListSummaryBar({ items }: { items: ListSummaryItem[] }) {
  return (
    <div className="erp-grid-toolbar">
      <span className="erp-grid-stats">
        {items.map((s) => (
          <span key={s.label} className="erp-grid-stat">
            {s.label} <b>{s.value}</b>
          </span>
        ))}
      </span>
    </div>
  );
}
