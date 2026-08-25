"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { ROUTE_PROGRESS_EVENT } from "@/lib/route-progress";

function isInternalNavClick(e: MouseEvent) {
  if (
    e.defaultPrevented ||
    e.button !== 0 ||
    e.metaKey ||
    e.ctrlKey ||
    e.shiftKey ||
    e.altKey
  ) {
    return false;
  }
  const anchor = (e.target as HTMLElement)?.closest?.(
    "a[href]",
  ) as HTMLAnchorElement | null;
  if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download"))
    return false;
  let url: URL;
  try {
    url = new URL(anchor.href, window.location.href);
  } catch {
    return false;
  }
  if (url.origin !== window.location.origin) return false;
  if (
    url.pathname === window.location.pathname &&
    url.search === window.location.search
  )
    return false;
  return true;
}

function ProgressWatcher() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [active, setActive] = useState(false);
  const routeKeyRef = useRef(`${pathname}?${searchParams.toString()}`);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const key = `${pathname}?${searchParams.toString()}`;
    if (routeKeyRef.current !== key) {
      routeKeyRef.current = key;
      setActive(false);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    }
  }, [pathname, searchParams]);

  useEffect(() => {
    function start() {
      setActive(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      // 같은 경로에 머무는 저장/제출처럼 URL이 바뀌지 않는 경우나, 느린
      // 배포 환경에서 이동이 오래 걸리는 경우를 대비한 안전장치. 너무 짧으면
      // 실제로는 아직 이동 중인데 바가 먼저 꺼져버려서 "멈춘 것처럼" 보이므로
      // 넉넉하게 잡는다 — 정상 이동이면 pathname 변경 effect가 먼저 꺼준다.
      timeoutRef.current = setTimeout(() => setActive(false), 15000);
    }
    function onClick(e: MouseEvent) {
      if (isInternalNavClick(e)) start();
    }
    function onSubmit() {
      start();
    }

    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    // ClickableRow(행 클릭)/탭바/리본/알림종처럼 <a> 없이 router.push()로
    // 바로 이동하는 곳은 위 클릭 감지에 안 걸리므로, 그런 곳은 이 이벤트로
    // 직접 알려준다 (src/lib/route-progress.ts).
    window.addEventListener(ROUTE_PROGRESS_EVENT, start);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
      window.removeEventListener(ROUTE_PROGRESS_EVENT, start);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  if (!active) return null;
  return <div className="erp-progress-bar" aria-hidden />;
}

export function RouteProgressBar() {
  return (
    <Suspense fallback={null}>
      <ProgressWatcher />
    </Suspense>
  );
}
