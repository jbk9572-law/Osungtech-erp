"use client";

import { useCallback, useRef, useState, useEffect, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { useScrollLock } from "@/lib/use-scroll-lock";
import { ModalCloseProvider, ModalCloseHrefProvider } from "@/lib/modal-context";

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
  // 닫기는 실제 라우트 이동이 끝나는 걸 절대 기다리지 않는다 — 클릭한
  // 순간 이 상태를 true로 바꿔서 모달 전체(배경막+카드)를 즉시 화면에서
  // 지운다. 그 아래엔 이미 그려져 있던 목록 화면(@children)이 그대로
  // 있으므로 이걸로 "닫힘"은 완성이고, 주소를 배경 화면 URL로 되돌리는
  // 실제 라우트 이동은 그 뒤에 조용히 백그라운드로 흘려보낸다(닫힘의
  // 체감 속도가 그 이동 성공/실패나 속도에 더 이상 좌우되지 않는다).
  const [closing, setClosing] = useState(false);
  // 이 모달의 페이지가 KeyboardShortcuts를 통해 알려주는 "진짜 닫기
  // 목적지"(그 페이지의 Escape.href와 같은 값). 있으면 이걸로 명시
  // 이동하고, 아직 등록되기 전(마운트 직후 극히 짧은 순간)이면만
  // router.back()으로 대체한다 — 뒤로가기는 이 모달을 어떤 경로로
  // 거쳐 왔는지에 따라 엉뚱한 화면으로 가버릴 수 있어 더 이상 기본
  // 닫기 수단으로 쓰지 않는다.
  const closeHrefRef = useRef<string | null>(null);
  // 목적지를 알게 되는 즉시 미리 가져와둔다(router.prefetch). 등록/수정
  // 저장 직후처럼 revalidatePath로 목적지 화면의 캐시가 막 무효화된
  // 상태면 push 시점에 서버 왕복이 걸려 "닫힘"이 아니라 "이동 중"으로
  // 보이는 문제가 있었다 — X를 누르기 전에(모달이 열려 있는 동안) 미리
  // 데워두면 실제 클릭 시점엔 캐시 히트라 즉시 닫히는 것처럼 보인다.
  const registerCloseHref = useCallback(
    (href: string) => {
      if (closeHrefRef.current === href) return;
      closeHrefRef.current = href;
      router.prefetch(href);
    },
    [router],
  );

  const beginClosing = useCallback(() => {
    setClosing(true);
  }, []);

  const close = useCallback(() => {
    // 화면에서 즉시 사라지는 건 여기서 끝 — 이 아래 라우트 이동은 이미
    // "닫힌" 사용자 눈에는 안 보이는 뒷정리일 뿐이라, 성공/실패나 속도가
    // 닫힘 자체의 체감에 더 이상 영향을 주지 않는다.
    beginClosing();
    if (closeHrefRef.current) {
      // 이 페이지가 등록해준 정확한 목적지로 명시 이동한다 — 브라우저
      // 히스토리(router.back())에 기대지 않으므로 이 모달을 어떤 경로로
      // 거쳐 들어왔든 항상 같은 곳으로 닫힌다.
      router.push(closeHrefRef.current);
    } else {
      // 아직 목적지가 등록되지 않은 극히 짧은 순간(마운트 직후)에 대한
      // 안전장치일 뿐, 정상 상태에서는 위 분기로만 닫힌다.
      router.back();
    }
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
      className={`erp-modal-overlay${closing ? " closing" : ""}`}
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
          <ModalCloseProvider value={close}>
            <ModalCloseHrefProvider value={registerCloseHref}>{children}</ModalCloseHrefProvider>
          </ModalCloseProvider>
        </div>
      </div>
    </div>
  );
}
