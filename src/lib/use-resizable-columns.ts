"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const MIN_COLUMN_WIDTH = 32;

// 표 칸 너비를 마우스로 드래그해서 직접 조절하는 공용 훅 — 조절한 값은
// storageKey별로 localStorage에 저장해서 다음에 열어도 유지된다. 여러
// 표(매출/매입 등록 폼의 품목 그리드 등)가 각자 % 너비를 하드코딩하는
// 대신, 이 훅 하나로 드래그 조절 기능을 공용화한다.
export function useResizableColumns<Col extends string>(
  storageKey: string,
  defaults: Record<Col, number>,
) {
  const [widths, setWidths] = useState<Record<Col, number>>(() => {
    if (typeof window === "undefined") return defaults;
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (!saved) return defaults;
      const parsed = JSON.parse(saved) as Partial<Record<Col, number>>;
      return { ...defaults, ...parsed };
    } catch {
      return defaults;
    }
  });

  const [resizingCol, setResizingCol] = useState<Col | null>(null);
  const dragRef = useRef<{ col: Col; startX: number; startWidth: number } | null>(null);

  const persist = useCallback(
    (next: Record<Col, number>) => {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // 무시: 저장 실패해도(시크릿 모드 등) 화면 조절 자체는 그대로 동작한다.
      }
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
