"use client";

import { useRouter } from "next/navigation";
import { useSideSplit, useThemeFeatures } from "@/lib/erp-theme-features";
import { startRouteProgress } from "@/lib/route-progress";

// 목록 행을 눌렀을 때의 동작 — 모던 테마(오른쪽 패널을 쓰는 화면)는 패널이 안 보이는 좁은 폭에서 행 아래 아코디언 대신 상세 페이지로 이동한다(개발헌법 12번 A형).
// 클래식 테마와 패널이 보이는 넓은 화면은 기존 그대로 `fallback`(아코디언 펼침/패널 선택)을 쓴다.
export function useListRowOpen(fallback: (key: string) => void): (key: string, detailHref: string | null | undefined) => void {
  const { listSidePanel } = useThemeFeatures();
  const sideSplit = useSideSplit();
  const router = useRouter();
  return (key, detailHref) => {
    if (listSidePanel && !sideSplit && detailHref) {
      startRouteProgress();
      router.push(detailHref);
      return;
    }
    fallback(key);
  };
}
