"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useScrollLock } from "@/lib/use-scroll-lock";

const SIZE_CLASS = { md: "erp-modal-md", lg: "erp-modal-lg", xl: "erp-modal-xl" } as const;

// 화면 안에서 직접 열고 닫는 모달(통합 판매 등록·모조지 계산·리본의 빠른 검색/도움말 등)의 공용 틀.
// 예전엔 모달마다 배경 div에 click 으로 닫기를 따로 만들어서 ① 입력칸 안에서 글자를 끌다가 배경 위에서 손을 떼면 모달이 닫히고
// ② 배경 스크롤이 안 잠기고 ③ role="dialog"·포커스 이동·복귀가 없었다. 라우트로 뜨는 모달(registration-modal-shell)과 같은 규칙을 한 곳에 둔다:
//  · 배경을 "누른" 자리가 배경일 때만 닫는다(드래그 끝점은 무시) · Esc로 닫기(입력칸 안에서는 무시) · 스크롤 잠금 · 열리면 모달로 포커스, 닫히면 열었던 곳으로 복귀.
export function ModalOverlay({ onClose, size, children }: { onClose: () => void; size?: keyof typeof SIZE_CLASS; children: ReactNode }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useScrollLock(true);
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    if (dialog && !dialog.contains(document.activeElement)) dialog.focus({ preventScroll: true });
    return () => {
      if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      const t = e.target;
      if (t instanceof HTMLElement && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      className="erp-modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div ref={dialogRef} role="dialog" aria-modal="true" tabIndex={-1} className={`erp-modal${size ? ` ${SIZE_CLASS[size]}` : ""}`}>
        {children}
      </div>
    </div>
  );
}
