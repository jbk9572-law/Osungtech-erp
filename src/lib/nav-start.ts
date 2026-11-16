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

// 모달을 X·ESC·배경 클릭으로 닫는 것도 "화면을 떠난다"는 뜻이다 — 링크 클릭이 아니라서 위 판정에 안 걸리므로, 모달 셸이 닫을 때 직접 알린다.
// (저장이 끝나기 전에 모달을 닫았는데 저장 뒤 자동 이동이 상세 화면을 다시 띄우던 문제)
export const USER_LEFT_EVENT = "erp:user-left";

export function notifyUserLeft() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(USER_LEFT_EVENT));
}

export function subscribeNavStart(onStart: () => void): () => void {
  const onClick = (e: MouseEvent) => {
    if (isInternalNavClick(e)) onStart();
  };
  document.addEventListener("click", onClick, true);
  window.addEventListener(ROUTE_PROGRESS_EVENT, onStart);
  window.addEventListener(USER_LEFT_EVENT, onStart);
  return () => {
    document.removeEventListener("click", onClick, true);
    window.removeEventListener(ROUTE_PROGRESS_EVENT, onStart);
    window.removeEventListener(USER_LEFT_EVENT, onStart);
  };
}
