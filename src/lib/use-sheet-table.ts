"use client";

import { useMemo, useState, type KeyboardEvent } from "react";

// 스프레드시트형 목록의 공용 동작 — 열 정렬·열 숨김·방향키 행 이동·행 복사(TSV). A형 목록(RecordListA/PartyListA)이 같이 쓴다(개발헌법 12번).
export type SortState = { col: number; dir: 1 | -1 } | null;
export type CellValue = string | number | null | undefined;

function compare(a: CellValue, b: CellValue): number {
  const an = a === null || a === undefined || a === "";
  const bn = b === null || b === undefined || b === "";
  if (an || bn) return an === bn ? 0 : an ? 1 : -1; // 빈 값은 항상 뒤로
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "ko");
}

export function useSheetTable<T extends { id: string }>(rows: T[], valueOf: (row: T, col: number) => CellValue) {
  const [sort, setSort] = useState<SortState>(null);
  const [hidden, setHidden] = useState<Set<number>>(new Set());

  const ordered = useMemo(() => {
    if (!sort) return rows;
    return [...rows].sort((x, y) => compare(valueOf(x, sort.col), valueOf(y, sort.col)) * sort.dir);
    // valueOf는 렌더마다 새로 만들어지지만 rows/sort가 같으면 결과가 같다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sort]);

  // 같은 열을 누를 때마다 오름 → 내림 → 해제
  const toggleSort = (col: number) => setSort((p) => (!p || p.col !== col ? { col, dir: 1 } : p.dir === 1 ? { col, dir: -1 } : null));
  const toggleHidden = (col: number) =>
    setHidden((p) => {
      const next = new Set(p);
      if (next.has(col)) next.delete(col);
      else next.add(col);
      return next;
    });
  const ariaSort = (col: number): "ascending" | "descending" | "none" => (sort?.col === col ? (sort.dir === 1 ? "ascending" : "descending") : "none");
  return { ordered, sort, toggleSort, hidden, toggleHidden, isVisible: (col: number) => !hidden.has(col), ariaSort };
}

// 목록 위에서 ↑/↓로 행 이동, Enter로 열기, Ctrl+C로 선택한 행을 탭 구분 텍스트로 복사 — 입력칸·버튼에서 누른 키는 건드리지 않는다.
export function useRowKeyboard(
  orderedIds: string[],
  activeId: string | null,
  setActiveId: (id: string) => void,
  onOpen: (id: string) => void,
  copyTextOf: (id: string) => string,
) {
  return (e: KeyboardEvent<HTMLElement>) => {
    const t = e.target as HTMLElement;
    if (t.closest("input, textarea, select, button, a")) return;
    const i = activeId ? orderedIds.indexOf(activeId) : -1;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = orderedIds[Math.min(orderedIds.length - 1, Math.max(0, i + (e.key === "ArrowDown" ? 1 : -1)))];
      if (next) setActiveId(next);
    } else if (e.key === "Enter" && activeId) {
      e.preventDefault();
      onOpen(activeId);
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c" && activeId && !window.getSelection()?.toString()) {
      e.preventDefault();
      void navigator.clipboard?.writeText(copyTextOf(activeId));
    }
  };
}
