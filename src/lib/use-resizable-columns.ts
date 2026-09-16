"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getGridColumnWidths, saveGridColumnWidths } from "@/lib/grid-column-widths-actions";

const MIN_COLUMN_WIDTH = 32;

// 표 칸 너비를 마우스로 드래그해서 직접 조절하는 공용 훅. 예전엔 조절한
// 값을 storageKey별로 localStorage에 저장했는데, 그러면 조절한 사람의
// 브라우저에서만 반영되고 다른 직원 화면은 계속 예전(깨져 보이는) 너비
// 그대로였다 — 이제 DB(ui_grid_column_widths, grid_key = storageKey)에
// 저장해서 누가 조절하든 전 직원 화면에 반영되게 한다.
//
// initialWidths(서버 컴포넌트가 페이지 렌더링 시점에 getGridColumnWidths로
// 미리 조회해 내려준 값)를 받으면 그걸로 첫 렌더부터 바로 채운다. 예전엔
// 항상 defaults로 먼저 그리고 마운트 후 비동기로 DB 값을 불러와 덮어썼는데,
// 그 사이 아주 짧게 좁은 defaults 폭이 보였다가 저장된 폭으로 "확 늘어나는"
// 애니메이션처럼 보이는 문제가 있었다(실사용 중 발견). 서버에서 이미 값을
// 들고 있으면 그 깜빡임 자체가 생기지 않으므로 클라이언트 재조회를 생략하고,
// 못 받은 경우(폼이 서버 프리페치 없이 단독으로 쓰이는 등)에만 예전처럼
// 마운트 후 조회로 대체한다.
export function useResizableColumns<Col extends string>(
  storageKey: string,
  defaults: Record<Col, number>,
  initialWidths?: Partial<Record<Col, number>> | null,
) {
  const [widths, setWidths] = useState<Record<Col, number>>(() => ({
    ...defaults,
    ...(initialWidths ?? undefined),
  }));
  const [resizingCol, setResizingCol] = useState<Col | null>(null);
  const dragRef = useRef<{ col: Col; startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    if (initialWidths) return;
    let cancelled = false;
    getGridColumnWidths(storageKey).then((saved) => {
      if (cancelled || !saved) return;
      setWidths((prev) => ({ ...prev, ...(saved as Partial<Record<Col, number>>) }));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const persist = useCallback(
    (next: Record<Col, number>) => {
      // 저장 실패해도 화면 조절 자체는 그대로 동작하게 에러를 화면에는
      // 띄우지 않는다 — 다만 완전히 조용히 삼키면 "DB 테이블이 아직
      // 없다" 같은 원인을 아무도 못 알아채고 조절값이 계속 안 남는
      // 채로 방치될 수 있어(실제로 이런 사고가 있었다), 콘솔에는 남긴다.
      saveGridColumnWidths(storageKey, next).catch((err) => {
        console.error(`표 칸 너비 저장 실패(${storageKey}):`, err);
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
