"use client";

import type { CSSProperties, PointerEvent } from "react";
import { MIN_COL_WIDTH, type SortState } from "@/lib/use-sheet-table";

// 머리글 오른쪽 끝의 너비 조절 손잡이 — 끌어서 열 너비를 바꾸고, 더블클릭하면 원래대로.
function ResizeHandle({ onResize }: { onResize: (px: number | null) => void }) {
  const start = (e: PointerEvent<HTMLSpanElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const th = e.currentTarget.parentElement as HTMLElement;
    const startX = e.clientX;
    const startW = th.getBoundingClientRect().width;
    const move = (ev: globalThis.PointerEvent) => onResize(Math.max(MIN_COL_WIDTH, startW + ev.clientX - startX));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  return <span className="erp-col-resizer" role="separator" aria-orientation="vertical" aria-label="열 너비 조절" onPointerDown={start} onDoubleClick={() => onResize(null)} onClick={(e) => e.stopPropagation()} />;
}

// 정렬 가능한 머리글 칸 — 누르면 오름 → 내림 → 해제. width/onResize를 주면 너비 조절 손잡이가 붙는다.
export function SortableTh({ label, col, sort, ariaSort, onSort, num, width, onResize }: { label: string; col: number; sort: SortState; ariaSort: "ascending" | "descending" | "none"; onSort: (col: number) => void; num?: boolean; width?: number; onResize?: (px: number | null) => void }) {
  return (
    <th className={`${num ? "num " : ""}${width ? "erp-th-sized" : ""}`.trim() || undefined} aria-sort={ariaSort} style={width ? ({ "--col-w": `${width}px` } as CSSProperties) : undefined}>
      <button type="button" onClick={() => onSort(col)} className="erp-th-btn">
        {label}
        {sort?.col === col ? (sort.dir === 1 ? " ▲" : " ▼") : ""}
      </button>
      {onResize && <ResizeHandle onResize={onResize} />}
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
