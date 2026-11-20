"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createRowsHistory } from "@/lib/rows-history";

// 매출/매입 등록, 보관위치 일괄등록처럼 "빈 줄 하나로 시작 → 품목 검색/
// 할일·입고 가져오기로 채워진 줄을 추가/중간삽입/삭제"하는 그리드 폼
// 여러 곳(new-sale-form.tsx, new-purchase-form.tsx, location-stock-form.tsx)에
// 거의 그대로 복붙돼 있던 key 채번 + 행 추가/삽입/삭제 로직을 하나로 묶었다.
// 각 폼은 자신의 Row 타입에 맞는 빈 줄 생성 함수만 넘기면 된다.
export function useKeyedRows<Row extends { key: number }>(
  initialRows: Row[],
  makeBlankRow: (key: number) => Row,
  // idleUndoShortcut: 줄 삭제 버튼을 마우스로 누르는 등으로 포커스가 아무 데도 없을 때(document.body)도 Ctrl+Z / Ctrl+Y를 받는다.
  // 한 화면에 줄 입력 폼이 둘 이상 동시에 떠 있으면 둘 다 반응하므로, 폼이 하나뿐인 전표 등록(매출/매입)만 켠다.
  opts: { idleUndoShortcut?: boolean } = {},
) {
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [nextKey, setNextKey] = useState(initialRows.length);

  // 되돌리기/다시 실행(Ctrl+Z / Ctrl+Y) — 줄 상태가 어떤 경로로 바뀌든(setRows 직접 호출 포함) 바뀐 뒤에 기록한다.
  // 폼마다 setRows를 여기저기서 직접 부르므로, 호출부를 일일이 고치지 않고 rows가 바뀐 것을 보고 쌓는다.
  const [history] = useState(() => createRowsHistory<Row[]>());
  const committed = useRef<Row[]>(initialRows);
  const restoring = useRef(false);
  useEffect(() => {
    if (rows === committed.current) return;
    if (restoring.current) {
      // 되돌리기/다시 실행으로 바뀐 것 — 새 기록을 쌓지 않는다.
      restoring.current = false;
      committed.current = rows;
      return;
    }
    const prev = committed.current;
    const structural = prev.length !== rows.length || prev.some((r, i) => r.key !== rows[i]?.key);
    history.record(prev, structural);
    committed.current = rows;
  }, [rows, history]);

  /** 한 단계 되돌린다. 되돌릴 것이 없으면 false. */
  const undoRows = useCallback((): boolean => {
    const prev = history.undo(committed.current);
    if (!prev) return false;
    restoring.current = true;
    setRows(prev);
    return true;
  }, [history]);

  const redoRows = useCallback((): boolean => {
    const next = history.redo(committed.current);
    if (!next) return false;
    restoring.current = true;
    setRows(next);
    return true;
  }, [history]);

  const idleUndo = opts.idleUndoShortcut ?? false;
  useEffect(() => {
    if (!idleUndo) return;
    const onKey = (e: KeyboardEvent) => {
      // 표 안에서 눌렀다면 표의 키 처리(focusGridRowShortcuts)가 이미 처리하고 preventDefault 했다 — 그 처리로 포커스가 사라져
      // activeElement가 body가 된 뒤라도 여기서 한 번 더 되돌리지 않게 defaultPrevented를 먼저 본다.
      if (e.defaultPrevented || !(e.ctrlKey || e.metaKey) || e.altKey || document.activeElement !== document.body) return;
      const k = e.key.toLowerCase();
      const handled = k === "z" && !e.shiftKey ? undoRows() : k === "y" || (k === "z" && e.shiftKey) ? redoRows() : false;
      if (handled) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [idleUndo, undoRows, redoRows]);

  function addRow() {
    setRows((prev) => [...prev, makeBlankRow(nextKey)]);
    setNextKey((k) => k + 1);
  }

  // 맨 아래에만 추가되던 "+ 행 추가"와 달리, 이미 입력해둔 줄들 사이에
  // 빠뜨린 항목을 끼워 넣고 싶을 때를 위한 것 — 그 줄 바로 아래에 빈 줄을
  // 삽입한다.
  function insertRowAfter(key: number) {
    setRows((prev) => {
      const idx = prev.findIndex((row) => row.key === key);
      if (idx === -1) return prev;
      const next = [...prev];
      next.splice(idx + 1, 0, makeBlankRow(nextKey));
      return next;
    });
    setNextKey((k) => k + 1);
  }

  function removeRow(key: number) {
    setRows((prev) => (prev.length > 1 ? prev.filter((row) => row.key !== key) : prev));
  }

  // 검색/가져오기로 이미 채워진 줄(들)을 추가할 때 쓴다 — 아직 아무것도
  // 안 고른 첫 빈 줄이면(비어있는 기본 폼 그대로) 그 줄들을 교체하고,
  // 아니면 뒤에 이어붙인다. "빈 줄" 판정 기준은 폼마다 다를 수 있어
  // isBlank로 받는다. makeRows는 이번에 채번할 시작 key를 받아 새 줄(들)을
  // 만든다 — nextKey를 미리 클로저로 캡처해두면 같은 렌더 안에서 여러 번
  // 호출됐을 때 값이 어긋날 수 있어, 항상 호출 시점의 최신 nextKey를 넘긴다.
  function addFilledRows(makeRows: (startKey: number) => Row[], isBlank: (row: Row) => boolean) {
    const newRows = makeRows(nextKey);
    setRows((prev) => (prev.length === 1 && isBlank(prev[0]) ? newRows : [...prev, ...newRows]));
    setNextKey((k) => k + newRows.length);
  }

  function addFilledRow(makeRow: (key: number) => Row, isBlank: (row: Row) => boolean) {
    addFilledRows((startKey) => [makeRow(startKey)], isBlank);
  }

  // 저장 성공 후 폼을 통째로 한 개짜리 빈 줄로 되돌릴 때 쓴다(location-
  // stock-form.tsx) — 기존 줄을 다 지우고 새로 시작하되, key는 계속
  // 늘려서 이전 줄들과 절대 겹치지 않게 한다.
  function resetToBlank() {
    setRows([makeBlankRow(nextKey)]);
    setNextKey((k) => k + 1);
  }

  // 저장 성공 뒤 폼을 비울 때(resetToBlank)는 이전 입력을 되돌릴 일이 없으므로 기록도 비운다.
  const resetToBlankAndClear = () => {
    resetToBlank();
    history.clear();
  };

  return { rows, setRows, nextKey, addRow, insertRowAfter, removeRow, addFilledRow, addFilledRows, resetToBlank: resetToBlankAndClear, undoRows, redoRows };
}
