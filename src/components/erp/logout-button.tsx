"use client";

import type { CSSProperties } from "react";
import { createPortal, useFormStatus } from "react-dom";

// 로그아웃 서버 액션이 Supabase Auth 서버 응답을 기다리는 동안(특히
// 무료 플랜 DB가 느릴 때) 버튼에 아무 반응이 없으면 "눌러도 안 먹힌다"고
// 오해해서 새로고침해버리는 제보가 있었다 — 실제로는 처리 중이었을 뿐인데
// 아무 피드백이 없어서 멈춘 것처럼 보였다. 버튼 문구만 바꾸는 걸로는
// 부족하다는 재지적을 받아, 전체 화면을 덮는 오버레이(기존 페이지 이동
// 중 오버레이와 같은 시각 언어 — .erp-nav-card/.erp-nav-gauge)까지
// 같이 띄운다 — 내부 직원용(title-bar.tsx)과 거래처/업체 포털용
// (portal/(app)/layout.tsx) 로그아웃 버튼 둘 다 이 컴포넌트를 공유한다.
export function LogoutButton({ className, style }: { className?: string; style?: CSSProperties }) {
  const { pending } = useFormStatus();
  return (
    <>
      <button type="submit" disabled={pending} className={className} style={style}>
        {pending ? "로그아웃 중..." : "로그아웃"}
      </button>
      {pending &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="erp-nav-overlay erp-logout-overlay" aria-hidden>
            <div className="erp-nav-card">
              <div className="erp-nav-gauge" />
              <div className="erp-nav-text">로그아웃 처리 중입니다...</div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
