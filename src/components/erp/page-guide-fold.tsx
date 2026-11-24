"use client";

import type { CSSProperties, ReactNode } from "react";
import { useThemeFeatures } from "@/lib/erp-theme-features";

// 안내 박스(PageGuide)의 화면 부분 — 새 틀(모던)에서는 안내가 화면마다 길이·유무가 제각각이던 것을, 모든 안내를 "안내" 한 줄(펼치면 전문)로 통일한다.
// 경고·위험 톤은 접지 않고 그대로 보인다(놓치면 안 되는 내용). 이전 테마는 예전 박스 그대로.
export function PageGuideFold({ tone, className, style, children }: { tone: string; className: string; style: CSSProperties; children: ReactNode }) {
  const { listFrameV2 } = useThemeFeatures();
  if (listFrameV2 && (tone === "info" || tone === "success")) {
    return (
      <details className={`${className} erp-page-guide-fold`} style={style}>
        <summary>안내</summary>
        <div className="erp-page-guide-fold-body">{children}</div>
      </details>
    );
  }
  return (
    <div className={className} style={style}>
      {children}
    </div>
  );
}
