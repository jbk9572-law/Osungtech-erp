"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { formatNumber } from "@/lib/format-number";
import { findGridRowPosition, type GridRowPosition } from "@/lib/grid-row-position";

// 하단 상태줄의 "행 3 / 48" — 화면의 첫 목록 표(.erp-grid)에서 지금 고른 행의 순서와 전체 행 수를 보여준다.
// 화면마다 따로 구현하지 않고 표의 클래스(master-active/selected)를 읽는 방식이라 모든 표에 자동 적용된다(GridSelectionStats와 같은 방식).
// 표가 없는 화면(대시보드·폼 등)에서는 아무것도 그리지 않는다. 불러온 행(예: 최근 300건)만 센다.
export function useGridRowPosition(): GridRowPosition | null {
  const pathname = usePathname();
  const [pos, setPos] = useState<GridRowPosition | null>(null);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const next = findGridRowPosition(document.getElementById("erp-main-content"));
      setPos((prev) => (prev && next && prev.index === next.index && prev.total === next.total ? prev : next));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    schedule();
    const root = document.getElementById("erp-main-content");
    const observer = new MutationObserver(schedule);
    if (root) observer.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ["class"] });
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [pathname]);
  return pos;
}

export function GridRowPositionStatus({ pos }: { pos: GridRowPosition | null }) {
  if (!pos) return null;
  return (
    <span className="erp-statusbar-rowpos" role="status">
      {pos.index > 0 ? (
        <>
          행 <b>{formatNumber(pos.index)}</b> / {formatNumber(pos.total)}
        </>
      ) : (
        <>전체 {formatNumber(pos.total)}행</>
      )}
    </span>
  );
}
