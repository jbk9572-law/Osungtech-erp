"use client";

import { useEffect } from "react";

// 홈 화면 설치(PWA) 조건 중 하나인 서비스워커 등록만 담당한다. 캐싱 전략은
// 없다 — sw.js 참고.
export function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // 등록 실패해도 앱 사용에는 지장이 없다(설치 배너만 안 뜸) — 조용히 무시.
      });
    }
  }, []);

  return null;
}
