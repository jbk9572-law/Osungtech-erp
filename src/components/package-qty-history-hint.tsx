"use client";

import { useState } from "react";

type HistoryEntry = { basePackageQty: number; changedAt: string };

// 단가 이력(PriceHistoryHint)과 같은 자리지만, KG처럼 실제로 담기는 양에
// 따라 박스당 수량이 매번 달라지는 품목을 위해 "이전 값으로 덮어쓰기"까지
// 지원한다 — PriceHistoryHint는 참고용 표시만 하고 클릭해도 값이
// 바뀌지 않지만, 여기서는 목록에서 값을 고르면 바로 입력칸에 채워진다.
export function PackageQtyHistoryHint({
  history,
  onSelect,
}: {
  history: HistoryEntry[];
  onSelect: (value: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  // 히스토리가 없으면(신규 상품이거나 한 번도 안 바뀐 경우) 굳이 안 보여준다
  // — 대부분의 EA 단위 상품에는 의미 없는 정보라 매번 뜨면 오히려 거슬린다.
  if (history.length === 0) return null;

  const latest = history[0];

  return (
    <div className="text-xs" style={{ marginTop: 4 }}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="font-medium hover:underline"
        style={{ color: "var(--erp-success)" }}
      >
        ✓ 최근 포장수량 {latest.basePackageQty.toLocaleString()} ({latest.changedAt}) · 히스토리{" "}
        {expanded ? "숨기기" : `${history.length}건 보기`}
      </button>
      {expanded && (
        <ul
          className="mt-1 max-w-xs space-y-0.5 rounded-sm border p-2"
          style={{ borderColor: "var(--erp-border)", background: "var(--erp-bg-subtle)" }}
        >
          {history.slice(0, 5).map((entry, index) => (
            <li key={index} className="flex items-center justify-between gap-4" style={{ color: "var(--erp-text-muted)" }}>
              <span>{entry.changedAt}</span>
              <button
                type="button"
                onClick={() => {
                  onSelect(entry.basePackageQty);
                  setExpanded(false);
                }}
                className="hover:underline"
                style={{ color: "var(--erp-primary)", fontWeight: 600 }}
              >
                {entry.basePackageQty.toLocaleString()}로 덮어쓰기
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
