"use client";

import { useRef, useState, type ReactNode } from "react";
import { useClickOutside } from "@/lib/use-click-outside";
import { useEscapeToClose } from "@/lib/use-escape-to-close";

// 도구 줄의 "일괄 작업 ▾" 같은 묶음 메뉴 — 표준 동작(조회·신규·수정·삭제·엑셀) 말고 화면 전용 동작을 한 버튼으로 묶는다(R-003).
// 모양은 열 설정 메뉴(.erp-colmenu)와 같다. 항목은 children에 `ToolbarMenuLink`(이동)나 `ToolbarMenuButton`(동작)으로 넣는다.
// 메뉴가 닫혀도 children은 마운트된 채 남는다(항목이 연 모달의 상태가 사라지지 않게).
export function ToolbarMenu({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(open, ref, () => setOpen(false));
  useEscapeToClose(open, () => setOpen(false));
  return (
    <div className="erp-colmenu" ref={ref}>
      <button type="button" className="erp-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {label} ▾
      </button>
      <div className="erp-colmenu-list" role="menu" hidden={!open} onClick={() => setOpen(false)}>
        {children}
      </div>
    </div>
  );
}
