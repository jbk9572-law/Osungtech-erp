"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useScrollLock } from "@/lib/use-scroll-lock";
import { startRouteProgress } from "@/lib/route-progress";

const SIZE_CLASS = {
  md: "erp-modal-md",
  lg: "erp-modal-lg",
  xl: "erp-modal-xl",
} as const;

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

  const close = useCallback(() => {
    // 배경 목록으로 돌아가는 것도 실제 라우트 이동이라, 시간이 걸리면
    // "이동 중..." 표시가 뜨게 한다 — 안 그러면 닫히는 중인지 멈춘
    // 건지 구분할 수 없다(Link로 닫는 버튼들은 클릭 자체가 감지되어
    // 자동으로 뜨지만, 배경 클릭으로 닫을 때는 router.back()을 직접
    // 호출하는 거라 그 클릭 감지에 걸리지 않는다).
    startRouteProgress();
    router.back();
  }, [router]);

  useScrollLock(true);

  return (
    <div
      className="erp-modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className={`erp-modal ${SIZE_CLASS[size]}`} style={{ minHeight: 0 }}>
        <div className="erp-modal-body" style={{ flex: 1, minHeight: 0 }}>
          {children}
        </div>
      </div>
    </div>
  );
}
