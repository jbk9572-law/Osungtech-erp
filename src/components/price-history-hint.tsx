"use client";

import { useState } from "react";

type HistoryEntry = { unitPrice: number; orderDate: string };

export function PriceHistoryHint({ history }: { history: HistoryEntry[] }) {
  const [expanded, setExpanded] = useState(false);

  if (history.length === 0) {
    return <p className="text-xs text-gray-400">이전 판매 이력 없음 (신규 단가)</p>;
  }

  const latest = history[0];

  return (
    <div className="text-xs">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="font-medium text-green-700 hover:underline"
      >
        ✓ 최근단가 {latest.unitPrice.toLocaleString()}원 ({latest.orderDate}) · 히스토리{" "}
        {expanded ? "숨기기" : `${history.length}건 보기`}
      </button>
      {expanded && (
        <ul className="mt-1 max-w-xs space-y-0.5 rounded-md border border-gray-200 bg-gray-50 p-2">
          {history.slice(0, 5).map((entry, index) => (
            <li key={index} className="flex justify-between gap-4 text-gray-500">
              <span>{entry.orderDate}</span>
              <span>{entry.unitPrice.toLocaleString()}원</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
