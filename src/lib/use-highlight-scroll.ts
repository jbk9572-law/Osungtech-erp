"use client";

import { useEffect, useRef, type MutableRefObject } from "react";

// 검색 드롭다운에서 방향키로 강조(highlight) 위치를 옮길 때, 목록이 스크롤
// 영역이라 강조된 항목이 화면 밖으로 벗어나 있으면 방향키를 눌러도 눈에는
// 아무 변화가 없어 보였다 — 실제로는 highlight 상태가 바뀌고 있었지만
// 스크롤이 따라가지 않았을 뿐. 강조 위치가 바뀔 때마다 그 항목이 보이는
// 위치까지 스크롤한다.
export function useHighlightScroll(
  highlight: number,
  open: boolean,
): MutableRefObject<(HTMLElement | null)[]> {
  const itemRefs = useRef<(HTMLElement | null)[]>([]);
  useEffect(() => {
    if (open) itemRefs.current[highlight]?.scrollIntoView({ block: "nearest" });
  }, [highlight, open]);
  return itemRefs;
}
