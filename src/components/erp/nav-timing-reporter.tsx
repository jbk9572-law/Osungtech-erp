"use client";

import { Suspense, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { ROUTE_PROGRESS_EVENT, ROUTE_LOADING_MARKER_SELECTOR } from "@/lib/route-progress";
import { PERF_BUDGET } from "@/lib/perf-budget";
import { reportSlowNavigation } from "@/app/(dashboard)/perf-actions";

// 메뉴·탭·행 클릭으로 화면을 옮길 때 "누른 순간 → 로딩 화면이 걷히고 내용이 그려지기까지"의 시간을 모든 화면에서 잰다.
// 화면마다 따로 계측을 붙이지 않아도 앱 전체가 같은 기준(PERF_BUDGET.navigationMs)으로 기록된다. 느린 이동만, 같은 화면은
// 1분에 한 번만 서버로 보낸다(서버 액션이 Sentry에 남김). 화면 동작에는 아무 영향이 없다.
const REPORT_INTERVAL_MS = 60_000;

function isInternalNavClick(e: MouseEvent) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
  const anchor = (e.target as HTMLElement)?.closest?.("a[href]") as HTMLAnchorElement | null;
  if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return false;
  try {
    const url = new URL(anchor.href, window.location.href);
    return url.origin === window.location.origin && !(url.pathname === window.location.pathname && url.search === window.location.search);
  } catch {
    return false;
  }
}

function Watcher() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const startRef = useRef<number | null>(null);
  const lastReported = useRef(new Map<string, number>());
  const key = `${pathname}?${searchParams.toString()}`;
  const keyRef = useRef(key);

  useEffect(() => {
    const begin = () => {
      startRef.current = performance.now();
    };
    const onClick = (e: MouseEvent) => {
      if (isInternalNavClick(e)) begin();
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener(ROUTE_PROGRESS_EVENT, begin);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener(ROUTE_PROGRESS_EVENT, begin);
    };
  }, []);

  useEffect(() => {
    if (keyRef.current === key) return;
    keyRef.current = key;
    const started = startRef.current;
    if (started === null) return;
    startRef.current = null;

    let observer: MutationObserver | null = null;
    let cancelled = false;
    const finish = () => {
      if (cancelled) return;
      observer?.disconnect();
      // 다음 그리기까지 지나야 "사용자가 내용을 본" 시점이다.
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          const ms = performance.now() - started;
          if (ms < PERF_BUDGET.navigationMs) return;
          const now = Date.now();
          if (now - (lastReported.current.get(pathname) ?? 0) < REPORT_INTERVAL_MS) return;
          lastReported.current.set(pathname, now);
          void reportSlowNavigation(pathname, ms).catch(() => undefined);
        }),
      );
    };
    if (!document.querySelector(ROUTE_LOADING_MARKER_SELECTOR)) {
      finish();
    } else {
      observer = new MutationObserver(() => {
        if (!document.querySelector(ROUTE_LOADING_MARKER_SELECTOR)) finish();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, [key, pathname]);

  return null;
}

export function NavTimingReporter() {
  return (
    <Suspense fallback={null}>
      <Watcher />
    </Suspense>
  );
}
