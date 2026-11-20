"use client";

import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { useEscapeToClose } from "@/lib/use-escape-to-close";

// 표 칸에서 열리는 작은 입력창(비고 ✎, 행 옵션 ⚙, 계산식 fx) 공용 틀 — 칸을 가리지 않고 버튼 바로 아래에 뜨고, 표의 스크롤 영역에 잘리지 않게 body에 띄운다.
// 바깥을 누르거나 Esc를 누르면 닫힌다(Esc는 캡처 단계에서 먼저 소비돼 전표 저장·모달 닫기로 번지지 않는다).
export function CellPopover({
  rect,
  onClose,
  label,
  width = 260,
  children,
}: {
  /** 눌린 버튼의 화면 위치 — 이 아래에 띄운다 */
  rect: DOMRect;
  onClose: () => void;
  /** 접근성 이름(화면 낭독용) */
  label: string;
  width?: number;
  children: ReactNode;
}) {
  useEscapeToClose(true, onClose);
  const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8));
  const top = rect.bottom + 4;
  return createPortal(
    <>
      <div className="erp-cell-pop-backdrop" onMouseDown={onClose} />
      <div role="dialog" aria-label={label} className="erp-cell-pop" style={{ top, left, width }}>
        {children}
      </div>
    </>,
    document.body,
  );
}
