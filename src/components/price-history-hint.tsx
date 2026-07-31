"use client";

import { useState } from "react";

type HistoryEntry = { unitPrice: number; orderDate: string };

export function PriceHistoryHint({ history }: { history: HistoryEntry[] }) {
  const [expanded, setExpanded] = useState(false);

  if (history.length === 0) {
    return (
      <p className="text-xs" style={{ color: "#9aa2ad" }}>
        이전 판매 이력 없음 (신규 단가)
      </p>
    );
  }

  // history는 최신순으로 정렬돼 들어온다. 같은 가격으로 여러 번 주문된 것도
  // 매번 나열하면 언제 얼마가 바뀌었는지 알아보기 어려우므로, 최근가 옆에는
  // 그 직전과 다른 가격이 나올 때만(=실제로 바뀐 지점) "이전가 → 최근가"로
  // 보여준다.
  const latest = history[0];
  const previousDifferent = history.find((h) => h.unitPrice !== latest.unitPrice);

  return (
    <div className="text-xs">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="font-medium hover:underline"
        style={{ color: "#28a745" }}
      >
        ✓ 최근단가{" "}
        {previousDifferent && `${previousDifferent.unitPrice.toLocaleString()}원 → `}
        {latest.unitPrice.toLocaleString()}원 ({latest.orderDate}) · 히스토리{" "}
        {expanded ? "숨기기" : `${history.length}건 보기`}
      </button>
      {expanded && (
        <ul
          className="mt-1 max-w-xs space-y-0.5 rounded-sm border p-2"
          style={{ borderColor: "#d9d9d9", background: "#f7f9fc" }}
        >
          {history.slice(0, 5).map((entry, index) => {
            // 그 다음(더 과거) 항목과 비교해 이 시점에 가격이 바뀌었는지
            // 보여준다 — history가 최신순이라 index+1이 하나 더 과거다.
            const older = history[index + 1];
            const changed = older && older.unitPrice !== entry.unitPrice;
            return (
              <li key={index} className="flex justify-between gap-4" style={{ color: "#6b7280" }}>
                <span>{entry.orderDate}</span>
                <span>
                  {changed
                    ? `${older.unitPrice.toLocaleString()}원 → ${entry.unitPrice.toLocaleString()}원`
                    : `${entry.unitPrice.toLocaleString()}원`}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
