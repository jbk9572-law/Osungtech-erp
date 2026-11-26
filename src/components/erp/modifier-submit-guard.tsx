"use client";

import { useEffect } from "react";

// 입력칸에서 Ctrl/Shift/⌘+Enter를 누르면 브라우저가 "폼을 새 탭·새 창으로 제출"해 버린다(검색창에서 신규 단축키 Ctrl+Enter를
// 누르면 검색 결과가 새 탭으로 뜨던 증상). 이 앱에서 수정키+Enter는 단축키(신규=Ctrl+Enter)나 각 화면의 자체 처리뿐이므로,
// 한 줄 입력칸(<input>)에서는 브라우저의 기본 제출 동작만 막는다. 각 화면의 keydown 처리는 그대로 동작한다(막는 건 기본 동작뿐).
// 여러 줄 입력(textarea)·편집기·버튼은 건드리지 않는다.
export function ModifierSubmitGuard() {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Enter" || !(e.ctrlKey || e.metaKey || e.shiftKey)) return;
      const t = e.target;
      if (!(t instanceof HTMLInputElement) || !t.form) return;
      e.preventDefault();
    }
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);
  return null;
}
