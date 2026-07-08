"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function isInternalNavClick(e: MouseEvent) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
    return false;
  }
  const anchor = (e.target as HTMLElement)?.closest?.("a[href]") as HTMLAnchorElement | null;
  if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return false;
  let url: URL;
  try {
    url = new URL(anchor.href, window.location.href);
  } catch {
    return false;
  }
  if (url.origin !== window.location.origin) return false;
  if (url.pathname === window.location.pathname && url.search === window.location.search) return false;
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
      // 같은 경로에 머무는 저장/제출처럼 URL이 바뀌지 않는 경우를 대비한 안전장치.
      timeoutRef.current = setTimeout(() => setActive(false), 4000);
    }
    function onClick(e: MouseEvent) {
      if (isInternalNavClick(e)) start();
    }
    function onSubmit() {
      start();
    }

    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
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
