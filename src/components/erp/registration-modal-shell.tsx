"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";

// 매출/매입 등록 폼을 목록 화면 위 모달로 띄우는 공용 셸.
// (dashboard)/@modal 인터셉트 라우트에서만 쓰이며, 실제 등록 폼(new-sale-form.tsx /
// new-purchase-form.tsx)은 전혀 복제하지 않고 그대로 children으로 렌더링한다 —
// 폼을 고치면 모달/전체화면 두 경로 모두 자동으로 같이 바뀐다.
export function RegistrationModalShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const close = useCallback(() => {
    router.back();
  }, [router]);

  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  return (
    <div
      className="erp-modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="erp-modal erp-modal-xl" style={{ minHeight: 0 }}>
        <div className="erp-modal-body" style={{ flex: 1, minHeight: 0 }}>
          {children}
        </div>
      </div>
    </div>
  );
}
