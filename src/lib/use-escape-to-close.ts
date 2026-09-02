"use client";

import { useEffect } from "react";

// 이게 열려 있는 동안은 Escape를 캡처 단계에서 먼저 가로채 이것만 닫는다.
// 페이지 곳곳에 있는 전역 ESC 단축키(KeyboardShortcuts, window에 버블
// 단계로 걸려있음)까지 그대로 이벤트가 도달하면, 드롭다운/모달/라이트박스
// 하나만 닫으려던 것뿐인데 입력 중이던 폼 전체를 나가버리는 사고가 난다.
// 버블 단계 핸들러로는(포커스가 이미 벗어난 경우 등을 포함해) 확실히
// 막을 수 없어서 반드시 캡처 단계에서 stopPropagation해야 한다 —
// paper-calc-modal-trigger.tsx에서 처음 발견/수정했던 문제를 재사용
// 가능한 훅으로 뺐다.
export function useEscapeToClose(active: boolean, onClose: () => void) {
  useEffect(() => {
    if (!active) return;
    function handleEscapeCapture(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    }
    window.addEventListener("keydown", handleEscapeCapture, true);
    return () => window.removeEventListener("keydown", handleEscapeCapture, true);
  }, [active, onClose]);
}
