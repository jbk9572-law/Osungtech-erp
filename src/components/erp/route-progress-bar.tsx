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

// 인터셉트 라우트(@modal)처럼 목적지에 route-level loading.tsx가 먼저
// 끼어드는 화면들의 로딩 화면 루트에 이 마커를 심어둔다(@modal/loading.tsx,
// (dashboard)/loading.tsx, platform-admin/loading.tsx). usePathname()은
// 그 로딩 화면이 뜨는 시점에 이미 새 주소로 바뀌어버리기 때문에, "주소가
// 바뀜 = 이동 끝남"으로만 보면 실제 내용(느린 조회)이 하나도 안 온
// 시점에 오버레이가 너무 일찍 꺼진다 — 이 마커가 DOM에 있는 동안은 아직
// 로딩 화면만 떠 있는 것으로 보고 오버레이를 계속 띄워둔다.
const ROUTE_LOADING_MARKER_SELECTOR = "[data-erp-route-loading]";

function ProgressWatcher() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [phase, setPhase] = useState<Phase>("idle");
  const phaseRef = useRef<Phase>("idle");
  const routeKeyRef = useRef(`${pathname}?${searchParams.toString()}`);
  const showTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safetyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doneTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadingObserverRef = useRef<MutationObserver | null>(null);

  function setPhaseTracked(next: Phase) {
    phaseRef.current = next;
    setPhase(next);
  }

  function finish() {
    if (loadingObserverRef.current) {
      loadingObserverRef.current.disconnect();
      loadingObserverRef.current = null;
    }
    if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
    // 오버레이가 이미 떠 있던 상태에서 이동이 끝났다 — 짧게 페이드
    // 아웃한 뒤 완전히 지운다.
    doneTimeoutRef.current = setTimeout(() => setPhaseTracked("idle"), 220);
    setPhaseTracked("done");
  }

  useEffect(() => {
    const key = `${pathname}?${searchParams.toString()}`;
    if (routeKeyRef.current === key) return;
    routeKeyRef.current = key;
    if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current);
    if (loadingObserverRef.current) {
      loadingObserverRef.current.disconnect();
      loadingObserverRef.current = null;
    }
    setPhase((prev) => {
      phaseRef.current = prev;
      if (prev !== "visible") {
        phaseRef.current = "idle";
        return "idle";
      }
      if (!document.querySelector(ROUTE_LOADING_MARKER_SELECTOR)) {
        if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
        doneTimeoutRef.current = setTimeout(() => setPhaseTracked("idle"), 220);
        phaseRef.current = "done";
        return "done";
      }
      // 아직 로딩 화면만 떠 있다 — 그 마커가 실제로 사라지는 순간(또는
      // 위 safetyTimeoutRef 15초 안전장치)까지 "visible"을 유지한다.
      const observer = new MutationObserver(() => {
        if (!document.querySelector(ROUTE_LOADING_MARKER_SELECTOR)) finish();
      });
      observer.observe(document.body, { childList: true, subtree: true });
      loadingObserverRef.current = observer;
      return prev;
    });
    // finish는 렌더마다 새로 만들어지는 클로저라 deps에 넣으면 매 렌더
    // 재실행된다 — ref로만 상태를 주고받으므로 넣지 않아도 안전하다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  useEffect(() => {
    function start() {
      if (doneTimeoutRef.current) clearTimeout(doneTimeoutRef.current);
      if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current);
      if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
      if (loadingObserverRef.current) {
        loadingObserverRef.current.disconnect();
        loadingObserverRef.current = null;
      }
      showTimeoutRef.current = setTimeout(() => {
        setPhaseTracked("visible");
        // 같은 경로에 머무는 저장/제출처럼 URL이 안 바뀌는 경우나 배포
        // 환경이 아주 느린 경우, 또는 위 로딩 마커가 끝까지 안 사라지는
        // 경우를 대비한 안전장치.
        safetyTimeoutRef.current = setTimeout(() => setPhaseTracked("idle"), 15000);
      }, SHOW_DELAY_MS);
    }
    function onClick(e: MouseEvent) {
      if (isInternalNavClick(e)) start();
    }
    // 캡처 단계에서 잡으면, 폼의 onSubmit이 아직 실행되기도 전이라 그
    // 안에서 e.preventDefault()로 제출을 막는 경우(위치 배분 확인 모달을
    // 띄우려고 첫 제출을 가로채는 등)까지 실제 이동으로 오인해서 "이동
    // 중..." 오버레이가 그 모달 위에 겹쳐 뜬다. 버블 단계로 늦춰서 리액트의
    // onSubmit이 먼저 실행된 뒤(그래서 e.defaultPrevented가 반영된 뒤)
    // 판단하면, 실제로 막히지 않고 진짜 이동이 시작되는 제출에만 반응한다.
    function onSubmit(e: SubmitEvent) {
      if (e.defaultPrevented) return;
      start();
    }

    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, false);
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
      if (loadingObserverRef.current) loadingObserverRef.current.disconnect();
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
