"use client";

import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { getGridColumnVisibility, saveGridColumnVisibility } from "@/lib/grid-column-visibility-actions";

export const MIN_COL_WIDTH = 48;

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

// persistKey를 주면 숨긴 열을 계정별로 저장한다(매출·매입의 "열 설정"과 같은 저장 방식 — use-column-visibility.ts). 열 번호를 문자열로 저장한다.
export function useSheetTable<T extends { id: string }>(rows: T[], valueOf: (row: T, col: number) => CellValue, persistKey?: string) {
  const [sort, setSort] = useState<SortState>(null);
  const [hidden, setHidden] = useState<Set<number>>(new Set());
  useEffect(() => {
    if (!persistKey) return;
    let cancelled = false;
    getGridColumnVisibility(persistKey).then((saved) => {
      if (cancelled || !saved) return;
      setHidden(new Set(saved.map(Number).filter((n) => Number.isInteger(n))));
    });
    return () => {
      cancelled = true;
    };
  }, [persistKey]);
  // 끌어서 바꾼 열 너비(px) — 이 화면을 연 동안만 유지한다(저장하지 않음)
  const [widths, setWidths] = useState<Record<number, number>>({});
  const setWidth = (col: number, px: number | null) =>
    setWidths((p) => {
      const next = { ...p };
      if (px === null) delete next[col];
      else next[col] = Math.max(MIN_COL_WIDTH, Math.round(px));
      return next;
    });

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
      if (persistKey) saveGridColumnVisibility(persistKey, [...next].map(String)).catch((err) => console.error(`열 설정 저장 실패(${persistKey}):`, err));
      return next;
    });
  const ariaSort = (col: number): "ascending" | "descending" | "none" => (sort?.col === col ? (sort.dir === 1 ? "ascending" : "descending") : "none");
  return { ordered, sort, toggleSort, widths, setWidth, hidden, toggleHidden, isVisible: (col: number) => !hidden.has(col), ariaSort };
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
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c" && activeId && !window.getSelection()?.toString() && !document.querySelector(".erp-cell-selected")) {
      // 끌어서 칸 범위를 골랐다면 Ctrl+C는 범위 복사(grid-cell-range)가 맡는다 — 행 복사가 덮어쓰지 않게 비킨다(방향키·Enter는 그대로 동작).
      e.preventDefault();
      void navigator.clipboard?.writeText(copyTextOf(activeId));
    }
  };
}
