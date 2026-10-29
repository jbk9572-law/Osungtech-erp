"use client";

import { useCallback, useEffect, useState } from "react";
import { getGridColumnVisibility, saveGridColumnVisibility } from "@/lib/grid-column-visibility-actions";

// 표의 "보고 싶은 칸만 보기" 공용 훅. 칸 너비(use-resizable-columns)와
// 다르게 계정마다 따로 저장된다 — 내가 숨긴 칸이 다른 직원 화면에는
// 영향을 주지 않는다. 처음엔 전부 보이는 상태로 시작했다가(안전한
// 기본값) 마운트 후 저장된 설정을 불러와 반영한다 — 숨김 설정이 늦게
// 반영돼도 "칸이 잠깐 더 보이다가 줄어드는" 정도라 칸 너비 점프만큼
// 거슬리지 않아 서버 프리페치 없이 간단하게 간다.
export function useColumnVisibility(gridKey: string) {
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    let cancelled = false;
    getGridColumnVisibility(gridKey).then((saved) => {
      if (cancelled || !saved) return;
      setHiddenKeys(new Set(saved));
    });
    return () => {
      cancelled = true;
    };
  }, [gridKey]);

  const persist = useCallback(
    (next: Set<string>) => {
      saveGridColumnVisibility(gridKey, [...next]).catch((err) => {
        console.error(`표 칸 표시 설정 저장 실패(${gridKey}):`, err);
      });
    },
    [gridKey],
  );

  const toggleColumn = useCallback(
    (key: string) => {
      setHiddenKeys((prev) => {
        const next = new Set(prev);
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
        }
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const isHidden = useCallback((key: string) => hiddenKeys.has(key), [hiddenKeys]);

  return { hiddenKeys, isHidden, toggleColumn };
}
