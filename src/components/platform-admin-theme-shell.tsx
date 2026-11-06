"use client";

import { useEffect, useState } from "react";

// 다크/모던 테마는 플랫폼관리자 콘솔 전용이다(사용자 요청: "다크모드를 저
// 메뉴가아니라 플랫폼 전체관리자페이지에 넣어주라는거고" — 일반 테넌트
// 사용자가 보는 ERP 화면은 절대 안 건드림). <html>에 전역 속성을 붙이던
// 예전 방식(layout.tsx의 인라인 스크립트)은 테넌트 화면까지 같은
// localStorage를 공유해 새어나갈 위험이 있어 버렸다 — 대신 이 컴포넌트가
// platform-admin 레이아웃의 최상위 래퍼에만 클래스(.pa-theme-modern)를
// 붙인다. CSS 변수는 그 클래스가 걸린 div 밑으로만 상속되므로, 다른 테넌트
// 사용자는 물론 같은 브라우저로 /dashboard를 보는 경우에도 전혀 영향이
// 없다(erp-theme.css의 .pa-theme-modern 블록 참고).
const THEME_KEY = "erp-platform-admin-theme";
const THEME_CHANGE_EVENT = "pa-theme-change";

export function PlatformAdminThemeShell({
  className,
  style,
  children,
}: {
  className: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const [modern, setModern] = useState(false);

  useEffect(() => {
    function sync() {
      try {
        setModern(localStorage.getItem(THEME_KEY) === "modern");
      } catch {
        // 프라이빗 모드 등으로 못 읽어도 기본값(라이트)으로 둔다.
      }
    }
    sync();
    window.addEventListener(THEME_CHANGE_EVENT, sync);
    return () => window.removeEventListener(THEME_CHANGE_EVENT, sync);
  }, []);

  return (
    <div className={`${className}${modern ? " pa-theme-modern" : ""}`} style={style}>
      {children}
    </div>
  );
}

export { THEME_KEY as PLATFORM_ADMIN_THEME_KEY, THEME_CHANGE_EVENT as PLATFORM_ADMIN_THEME_CHANGE_EVENT };
