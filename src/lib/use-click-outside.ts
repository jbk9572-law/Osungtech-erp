"use client";

import { useEffect, type RefObject } from "react";

// 알림종/리본 드롭다운 등 "열려있는 동안 바깥을 클릭하면 닫힌다" 패턴이
// 여러 컴포넌트에 각자 거의 똑같이 중복돼 있던 걸 하나로 뺐다.
export function useClickOutside(
  active: boolean,
  refs: RefObject<HTMLElement | null> | RefObject<HTMLElement | null>[],
  onOutside: () => void
) {
  useEffect(() => {
    if (!active) return;
    const refList = Array.isArray(refs) ? refs : [refs];
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (refList.some((ref) => ref.current?.contains(target))) return;
      onOutside();
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refs 배열은 매 렌더마다 새 배열일 수 있어 의존성으로 넣지 않는다(ref 객체 자체는 안정적).
  }, [active, onOutside]);
}
