"use client";

import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { useScrollLock } from "@/lib/use-scroll-lock";
import { startRouteProgress } from "@/lib/route-progress";

const SIZE_CLASS = {
  md: "erp-modal-md",
  lg: "erp-modal-lg",
  xl: "erp-modal-xl",
} as const;

function isInternalNavAnchor(target: EventTarget | null): boolean {
  const anchor = (target as HTMLElement | null)?.closest?.(
    "a[href]",
  ) as HTMLAnchorElement | null;
  if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download"))
    return false;
  try {
    const url = new URL(anchor.href, window.location.href);
    return url.origin === window.location.origin;
  } catch {
    return false;
  }
}

// 목록 화면 위에 폼/상세 화면을 모달로 띄우는 공용 셸.
// (dashboard)/@modal 인터셉트 라우트에서만 쓰이며, 실제 페이지 컴포넌트는
// 전혀 복제하지 않고 그대로 children으로 렌더링한다 — 그 페이지를 고치면
// 모달/전체화면 두 경로 모두 자동으로 같이 바뀐다.
export function RegistrationModalShell({
  children,
  size = "xl",
}: {
  children: React.ReactNode;
  size?: "md" | "lg" | "xl";
}) {
  const router = useRouter();
  // 실제 페이지 이동(뒤에 있는 목록/상세 데이터 로딩)이 끝나길 기다리지
  // 않고, 닫는 클릭 즉시 모달을 시각적으로 먼저 닫아 보여준다 — 안 그러면
  // 이동이 조금만 느려도 "눌린 건지 렉인지" 구분이 안 된다는 지적이 있었다.
  const [closing, setClosing] = useState(false);

  const close = useCallback(() => {
    setClosing(true);
    // 배경 목록으로 돌아가는 것도 실제 라우트 이동이라, 시간이 걸리면
    // "이동 중..." 표시가 뜨게 한다(Link로 닫는 버튼들은 클릭 자체가
    // 감지되어 자동으로 뜨지만, 배경 클릭/ESC 키로 닫을 때는
    // router.back()을 직접 호출하는 거라 그 클릭 감지에 걸리지 않는다).
    startRouteProgress();
    router.back();
  }, [router]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      const target = e.target;
      const isEditable =
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      if (isEditable) return;
      close();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close]);

  useScrollLock(true);

  function handleClickCapture(e: MouseEvent<HTMLDivElement>) {
    // "ESC 닫기" 링크처럼 이 모달을 벗어나는 실제 이동이 시작되는 순간,
    // 그 이동이 끝나길 기다리지 않고 즉시 닫히는 모습을 보여준다.
    if (isInternalNavAnchor(e.target)) setClosing(true);
  }

  return (
    <div
      className="erp-modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className={`erp-modal ${SIZE_CLASS[size]}${closing ? " closing" : ""}`}
        style={{ minHeight: 0 }}
        onClickCapture={handleClickCapture}
      >
        <div className="erp-modal-body" style={{ flex: 1, minHeight: 0 }}>
          {children}
        </div>
      </div>
    </div>
  );
}
