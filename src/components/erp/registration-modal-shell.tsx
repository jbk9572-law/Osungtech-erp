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
  closeHref,
}: {
  children: React.ReactNode;
  size?: "md" | "lg" | "xl";
  // 이 모달 인터셉트 라우트가 항상 닫히는 고정 목적지(예: "/sales",
  // "/sales/123") — 호출부(@modal/(.)... 라우트 파일)가 자기 자신의
  // 위치만 보고 이미 알 수 있는 값이라 거의 모든 라우트가 넘긴다.
  // 아래 closeHrefRef의 "등록되기 전" 공백을 없애는 안전장치다: 이
  // 값이 있으면 마운트 즉시(= 첫 클릭부터) router.back() 대체 없이
  // push로 닫히고, 목록 화면이 조회필터(backParam)까지 유지해 돌아가야
  // 하는 화면은 KeyboardShortcuts의 Escape href 등록이 뒤이어 이
  // 값을 더 구체적인 것으로 덮어쓴다(registerCloseHref).
  closeHref?: string;
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
  // 목적지"(그 페이지의 Escape.href와 같은 값)로 덮어쓰기 전까지는
  // 위 closeHref prop을 기본값으로 쓴다 — 그래서 그 등록을 깜빡한
  // 화면(인쇄 미리보기 등)이나 마운트 직후의 극히 짧은 순간에도
  // router.back()(이 모달을 어떤 경로로 거쳐 왔는지에 따라 엉뚱한
  // 화면으로 가버릴 수 있다) 대신 항상 올바른 곳으로 닫힌다.
  const closeHrefRef = useRef<string | null>(closeHref ?? null);
  // 예전엔 목적지를 알게 되는 즉시 router.prefetch()로 미리 데워뒀는데,
  // 매출/매입처럼 날짜+검색어로 필터링한 목록 위에서 상세를 열었다가
  // 닫으면 그 필터가 초기화된 목록으로 돌아가는 버그가 있었다(사용자
  // 재현 — "1/1~10/30 기간에 SKU110 검색 후 상세 열었다 X로 닫으면
  // 검색조건이 사라진다"). 모달이 열려 있는 동안 미리 캐시해둔 "닫기
  // 목적지" 페이로드가 실제 닫는 시점의 최신 검색조건과 어긋날 수 있다는
  // 뜻이라, 사전 캐시 없이 닫는 시점에 항상 그 URL을 서버에서 새로
  // 받아오게 한다 — 등록/수정 저장 직후처럼 아주 짧게 로딩이 보일 수
  // 있지만, 검색 조건이 날아가는 것보다는 훨씬 낫다.
  const registerCloseHref = useCallback((href: string) => {
    closeHrefRef.current = href;
  }, []);

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
      // 거쳐 들어왔든 항상 같은 곳으로 닫힌다. refresh()로 그 목적지의
      // 클라이언트 캐시를 비워, 모달이 열려 있던 동안 캐시된 적이 있어도
      // 항상 최신 검색조건 기준 결과를 받아오게 한다.
      router.push(closeHrefRef.current);
      router.refresh();
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
