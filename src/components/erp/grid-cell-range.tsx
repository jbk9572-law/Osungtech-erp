"use client";

import { useEffect, useState } from "react";
import { formatNumber } from "@/lib/format-number";
import { summarizeCells, type GridSelectionSummary } from "@/lib/grid-selection-sum";

// 전표 표의 엑셀식 "칸 범위 선택" — 칸을 누른 채 끌면 사각형 범위가 파랗게 칠해지고, 그 안의 숫자 칸 합계·평균이 아래에 뜬다.
// 표 칸이 글자가 아니라 입력칸(input)이라 브라우저의 글자 선택으로는 안 되기 때문에 직접 처리한다.
// 두 칸 이상 끌었을 때만 범위로 보고(한 칸 클릭은 평소처럼 입력), 다른 곳을 누르거나 Esc를 누르면 풀린다.
// 문서 전체에서 .erp-voucher 안 표(.erp-grid)만 대상으로 하므로 화면마다 따로 연결하지 않는다.
const SELECTED = "erp-cell-selected";

type Cell = { table: HTMLTableElement; r: number; c: number };

function cellAt(el: EventTarget | null): Cell | null {
  const td = (el as HTMLElement | null)?.closest?.(".erp-voucher table.erp-grid tbody td") as HTMLTableCellElement | null;
  const tr = td?.parentElement as HTMLTableRowElement | null;
  const table = td?.closest("table") as HTMLTableElement | null;
  if (!td || !tr || !table) return null;
  return { table, r: tr.sectionRowIndex, c: td.cellIndex };
}

function clearMarks() {
  document.querySelectorAll(`.${SELECTED}`).forEach((el) => el.classList.remove(SELECTED));
}

function textOf(td: HTMLTableCellElement): string {
  const input = td.querySelector("input");
  return input ? input.value : (td.textContent ?? "");
}

export function GridCellRangeStats() {
  const [summary, setSummary] = useState<GridSelectionSummary | null>(null);

  useEffect(() => {
    let anchor: Cell | null = null;
    let dragging = false;

    const paint = (to: Cell) => {
      if (!anchor || anchor.table !== to.table) return;
      const [r1, r2] = [Math.min(anchor.r, to.r), Math.max(anchor.r, to.r)];
      const [c1, c2] = [Math.min(anchor.c, to.c), Math.max(anchor.c, to.c)];
      clearMarks();
      if (r1 === r2 && c1 === c2) {
        setSummary(null);
        return;
      }
      const texts: string[] = [];
      const rows = anchor.table.tBodies[0]?.rows ?? [];
      for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
          const td = rows[r]?.cells[c];
          if (!td || !td.offsetParent) continue;
          td.classList.add(SELECTED);
          texts.push(textOf(td));
        }
      }
      setSummary(summarizeCells(texts));
    };

    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      clearMarks();
      setSummary(null);
      anchor = cellAt(e.target);
      dragging = !!anchor;
    };
    const onMove = (e: MouseEvent) => {
      if (!dragging || !anchor || e.buttons !== 1) return;
      const to = cellAt(e.target);
      if (!to || (to.r === anchor.r && to.c === anchor.c && !document.querySelector(`.${SELECTED}`))) return;
      // 범위가 시작되면 입력칸 안 글자 드래그 선택이 같이 일어나지 않게 막는다
      window.getSelection()?.removeAllRanges();
      paint(to);
    };
    const onUp = () => {
      dragging = false;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && document.querySelector(`.${SELECTED}`)) {
        clearMarks();
        setSummary(null);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("keydown", onKey);
      clearMarks();
    };
  }, []);

  if (!summary) return null;
  return (
    <span className="erp-voucher-rangestats" role="status">
      선택한 셀 <b>{formatNumber(summary.count)}</b>개 · 합계 <b>{formatNumber(summary.sum)}</b> · 평균 <b>{formatNumber(summary.average)}</b>
    </span>
  );
}
