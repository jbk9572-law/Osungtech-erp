"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getGridColumnWidths, saveGridColumnWidths } from "@/lib/grid-column-widths-actions";

const MIN_COLUMN_WIDTH = 32;

// 표 칸 너비를 마우스로 드래그해서 직접 조절하는 공용 훅. 예전엔 조절한
// 값을 storageKey별로 localStorage에 저장했는데, 그러면 조절한 사람의
// 브라우저에서만 반영되고 다른 직원 화면은 계속 예전(깨져 보이는) 너비
// 그대로였다 — 이제 DB(ui_grid_column_widths, grid_key = storageKey)에
// 저장해서 누가 조절하든 전 직원 화면에 반영되게 한다. 첫 렌더는
// defaults로 그리고, 마운트 시 DB에서 저장된 값을 불러와 덮어쓴다
// (localStorage와 달리 비동기라 아주 짧게 defaults가 보였다가 바뀔 수
// 있음).
export function useResizableColumns<Col extends string>(
  storageKey: string,
  defaults: Record<Col, number>,
) {
  const [widths, setWidths] = useState<Record<Col, number>>(defaults);
  const [resizingCol, setResizingCol] = useState<Col | null>(null);
  const dragRef = useRef<{ col: Col; startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getGridColumnWidths(storageKey).then((saved) => {
      if (cancelled || !saved) return;
      setWidths((prev) => ({ ...prev, ...(saved as Partial<Record<Col, number>>) }));
    });
    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  const persist = useCallback(
    (next: Record<Col, number>) => {
      saveGridColumnWidths(storageKey, next).catch(() => {
        // 무시: 저장 실패해도 화면 조절 자체는 그대로 동작한다.
      });
    },
    [storageKey],
  );

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      const drag = dragRef.current;
      if (!drag) return;
      const delta = e.clientX - drag.startX;
      const nextWidth = Math.max(MIN_COLUMN_WIDTH, Math.round(drag.startWidth + delta));
      setWidths((prev) => ({ ...prev, [drag.col]: nextWidth }));
    }
    function onMouseUp() {
      if (!dragRef.current) return;
      dragRef.current = null;
      setResizingCol(null);
      setWidths((prev) => {
        persist(prev);
        return prev;
      });
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [persist]);

  const startResize = useCallback(
    (col: Col) => (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragRef.current = { col, startX: e.clientX, startWidth: widths[col] };
      setResizingCol(col);
    },
    [widths],
  );

  const resetWidths = useCallback(() => {
    setWidths(defaults);
    persist(defaults);
  }, [defaults, persist]);

  return { widths, startResize, resizingCol, resetWidths };
}
