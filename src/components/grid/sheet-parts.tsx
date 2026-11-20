"use client";

import type { SortState } from "@/lib/use-sheet-table";

// 정렬 가능한 머리글 칸 — 누르면 오름 → 내림 → 해제.
export function SortableTh({ label, col, sort, ariaSort, onSort, num }: { label: string; col: number; sort: SortState; ariaSort: "ascending" | "descending" | "none"; onSort: (col: number) => void; num?: boolean }) {
  return (
    <th className={num ? "num" : undefined} aria-sort={ariaSort}>
      <button type="button" onClick={() => onSort(col)} className="erp-th-btn">
        {label}
        {sort?.col === col ? (sort.dir === 1 ? " ▲" : " ▼") : ""}
      </button>
    </th>
  );
}

// 열 보이기/숨기기 메뉴 — <details>라 따로 열림 상태를 들고 있지 않는다.
export function SheetColumnMenu({ labels, hidden, onToggle }: { labels: string[]; hidden: Set<number>; onToggle: (col: number) => void }) {
  return (
    <details className="erp-colmenu">
      <summary className="erp-btn erp-btn-sm">열 설정{hidden.size ? ` (${hidden.size}개 숨김)` : ""}</summary>
      <div className="erp-colmenu-list" role="group" aria-label="열 보이기">
        {labels.map((l, i) => (
          <label key={l} className="erp-colmenu-item">
            <input type="checkbox" checked={!hidden.has(i)} onChange={() => onToggle(i)} disabled={!hidden.has(i) && hidden.size >= labels.length - 1} />
            {l}
          </label>
        ))}
      </div>
    </details>
  );
}
