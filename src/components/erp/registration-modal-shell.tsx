"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { useScrollLock } from "@/lib/use-scroll-lock";
import { startRouteProgress } from "@/lib/route-progress";
import { ModalCloseProvider } from "@/lib/modal-context";

const SIZE_CLASS = {
  md: "erp-modal-md",
  lg: "erp-modal-lg",
  xl: "erp-modal-xl",
} as const;

// 닫히는 모습(투명 처리)을 보여준 뒤, 이 시간 안에 실제 이동이 끝나
// 이 컴포넌트가 언마운트되지 않으면(=이동이 걸리거나 실패한 것) 원래
// 모습으로 되돌린다 — 안 그러면 배경 화면으로 못 돌아간 채 투명해진
// 모달만 남아 화면이 멈춘 것처럼 보인다.
const CLOSING_TIMEOUT_MS = 2000;

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
  const closingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (closingTimeoutRef.current) clearTimeout(closingTimeoutRef.current);
    };
  }, []);

  const beginClosing = useCallback(() => {
    setClosing(true);
    if (closingTimeoutRef.current) clearTimeout(closingTimeoutRef.current);
    // 실제 이동이 이 시간 안에 안 끝나면(=이 컴포넌트가 그대로 남아있으면)
    // 멈춘 것처럼 안 보이게 원래 모습으로 되돌린다.
    closingTimeoutRef.current = setTimeout(() => {
      setClosing(false);
    }, CLOSING_TIMEOUT_MS);
  }, []);

  const close = useCallback(() => {
    beginClosing();
    // 배경 목록으로 돌아가는 것도 실제 라우트 이동이라, 시간이 걸리면
    // "이동 중..." 표시가 뜨게 한다(Link로 닫는 버튼들은 클릭 자체가
    // 감지되어 자동으로 뜨지만, 배경 클릭/ESC 키로 닫을 때는
    // router.back()을 직접 호출하는 거라 그 클릭 감지에 걸리지 않는다).
    // 뒤로가기는 이미 열려 있던 배경 화면을 그대로 복원하는 것이라, 새로
    // 서버에 요청하는 방식보다 훨씬 안정적으로 끝난다.
    startRouteProgress();
    router.back();
  }, [router, beginClosing]);

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
    if (isInternalNavAnchor(e.target)) beginClosing();
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
        <button
          type="button"
          className="erp-modal-window-close print:hidden"
          onClick={close}
          aria-label="닫기"
        >
          ✕
        </button>
        <div className="erp-modal-body" style={{ flex: 1, minHeight: 0 }}>
          <ModalCloseProvider value={close}>{children}</ModalCloseProvider>
        </div>
      </div>
    </div>
  );
}
