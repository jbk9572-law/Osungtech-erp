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

type Phase = "idle" | "visible" | "done";

// 이동이 이보다 오래 걸릴 때만 오버레이를 띄운다. 평소 빠른 이동에서까지
// 매번 번쩍였다 사라지면 오히려 거슬리므로, 이 시간 안에 끝나면 오버레이가
// 뜨기도 전에 이동이 끝나 아무 것도 보여주지 않는다.
const SHOW_DELAY_MS = 200;

function ProgressWatcher() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [phase, setPhase] = useState<Phase>("idle");
  const routeKeyRef = useRef(`${pathname}?${searchParams.toString()}`);
  const showTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safetyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doneTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const key = `${pathname}?${searchParams.toString()}`;
    if (routeKeyRef.current !== key) {
      routeKeyRef.current = key;
      if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current);
      if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
      setPhase((prev) => {
        if (prev !== "visible") return "idle";
        // 오버레이가 이미 떠 있던 상태에서 이동이 끝났다 — 짧게 페이드
        // 아웃한 뒤 완전히 지운다.
        doneTimeoutRef.current = setTimeout(() => setPhase("idle"), 220);
        return "done";
      });
    }
  }, [pathname, searchParams]);

  useEffect(() => {
    function start() {
      if (doneTimeoutRef.current) clearTimeout(doneTimeoutRef.current);
      if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current);
      if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
      showTimeoutRef.current = setTimeout(() => {
        setPhase("visible");
        // 같은 경로에 머무는 저장/제출처럼 URL이 안 바뀌는 경우나 배포
        // 환경이 아주 느린 경우를 대비한 안전장치.
        safetyTimeoutRef.current = setTimeout(() => setPhase("idle"), 15000);
      }, SHOW_DELAY_MS);
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
      if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current);
      if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
      if (doneTimeoutRef.current) clearTimeout(doneTimeoutRef.current);
    };
  }, []);

  if (phase === "idle") return null;
  return (
    <div className={`erp-nav-overlay ${phase}`} aria-hidden>
      <div className="erp-nav-card">
        <div className="erp-nav-gauge" />
        <div className="erp-nav-text">이동 중...</div>
      </div>
    </div>
  );
}

export function RouteProgressBar() {
  return (
    <Suspense fallback={null}>
      <ProgressWatcher />
    </Suspense>
  );
}
