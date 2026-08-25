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

type Phase = "idle" | "loading" | "done";

function ProgressWatcher() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [phase, setPhase] = useState<Phase>("idle");
  const routeKeyRef = useRef(`${pathname}?${searchParams.toString()}`);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doneTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const key = `${pathname}?${searchParams.toString()}`;
    if (routeKeyRef.current !== key) {
      routeKeyRef.current = key;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      // 게이지를 90% 언저리에서 바로 지우지 않고, 순간적으로 100%까지 채운
      // 뒤 옅어지며 사라지게 한다 — 실제로 "이동이 끝났다"는 느낌을 준다.
      setPhase("done");
      doneTimeoutRef.current = setTimeout(() => setPhase("idle"), 500);
    }
  }, [pathname, searchParams]);

  useEffect(() => {
    function start() {
      if (doneTimeoutRef.current) clearTimeout(doneTimeoutRef.current);
      setPhase("loading");
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      // 같은 경로에 머무는 저장/제출처럼 URL이 바뀌지 않는 경우나, 느린
      // 배포 환경에서 이동이 오래 걸리는 경우를 대비한 안전장치. 너무 짧으면
      // 실제로는 아직 이동 중인데 바가 먼저 꺼져버려서 "멈춘 것처럼" 보이므로
      // 넉넉하게 잡는다 — 정상 이동이면 pathname 변경 effect가 먼저 꺼준다.
      timeoutRef.current = setTimeout(() => setPhase("idle"), 15000);
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
      if (doneTimeoutRef.current) clearTimeout(doneTimeoutRef.current);
    };
  }, []);

  if (phase === "idle") return null;
  return <div className={`erp-progress-bar ${phase}`} aria-hidden />;
}

export function RouteProgressBar() {
  return (
    <Suspense fallback={null}>
      <ProgressWatcher />
    </Suspense>
  );
}
