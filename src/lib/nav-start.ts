"use client";

import { ROUTE_PROGRESS_EVENT } from "@/lib/route-progress";

// "사용자가 다른 화면으로 이동을 시작했다"를 알아채는 공용 도구 — 같은 판정이 이동 로딩 오버레이, 이동 시간 측정기, 저장 후
// 자동 이동 훅에 각각 복사돼 있던 것을 한 곳으로 모았다. 링크(<a>) 클릭과, router.push로 직접 이동하는 곳(탭·리본 등)이
// 부르는 startRouteProgress() 이벤트 두 가지를 모두 본다.
export function isInternalNavClick(e: MouseEvent): boolean {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
  const anchor = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
  if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return false;
  try {
    const url = new URL(anchor.href, window.location.href);
    if (url.origin !== window.location.origin) return false;
    return !(url.pathname === window.location.pathname && url.search === window.location.search);
  } catch {
    return false;
  }
}

export function subscribeNavStart(onStart: () => void): () => void {
  const onClick = (e: MouseEvent) => {
    if (isInternalNavClick(e)) onStart();
  };
  document.addEventListener("click", onClick, true);
  window.addEventListener(ROUTE_PROGRESS_EVENT, onStart);
  return () => {
    document.removeEventListener("click", onClick, true);
    window.removeEventListener(ROUTE_PROGRESS_EVENT, onStart);
  };
}
