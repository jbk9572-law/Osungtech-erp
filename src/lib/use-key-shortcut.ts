"use client";

import { useEffect, type RefObject } from "react";

// 리본/버튼에 "F7 저장", "F6 삭제"처럼 단축키 라벨을 붙여놓고도 실제 키 입력은
// 무시되던 문제를 고치기 위한 훅. 지정한 키가 눌리면 해당 엘리먼트를 클릭한
// 것과 동일하게 동작시킨다 (form submit의 confirm 등 기존 동작을 그대로 탄다).
export function useKeyShortcut(key: string, ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== key) return;
      e.preventDefault();
      ref.current?.click();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [key, ref]);
}
