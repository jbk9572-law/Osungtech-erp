"use client";

import type { ReactNode } from "react";

// 품목 그리드 칸 헤더 — 칸 오른쪽 경계에 드래그 손잡이를 같이 넣어서 마우스로 끌어
// 너비를 직접 조절할 수 있게 한다. 매출/매입 등록 폼이 같은 마크업을 각자 가지고
// 있었다.
export function ResizableTh({
  width,
  resizing,
  onResizeStart,
  className,
  children,
}: {
  width: number;
  resizing: boolean;
  onResizeStart: (e: React.MouseEvent) => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <th className={className} style={{ width }}>
      {children}
      <span className={`erp-col-resize-handle${resizing ? " resizing" : ""}`} onMouseDown={onResizeStart} />
    </th>
  );
}
