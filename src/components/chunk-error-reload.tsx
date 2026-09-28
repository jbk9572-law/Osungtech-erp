"use client";

import { useEffect } from "react";

// 새 버전을 배포하면 파일명 해시가 바뀌는데, 배포 전부터 탭을 열어두고
// 있던 사용자가 메뉴를 클릭하면 브라우저가 이미 사라진 예전 해시의 JS
// 청크를 요청하다 실패한다("ChunkLoadError"/"Failed to fetch dynamically
// imported module") — 클릭해도 반응이 없거나 그 화면만 깨져 보이고,
// 수동으로 새로고침하면 최신 HTML을 다시 받아와서 정상화된다("리로드를
// 누르면 뜨는데 왜 자꾸 리로드해야 하냐"는 지적의 원인). 사용자가 매번
// 수동으로 새로고침해야 하는 대신, 이 종류의 에러를 감지하면 자동으로
// 한 번만 새로고침한다 — 무한 새로고침을 막기 위해 세션당 1회로 제한한다.
const RELOAD_FLAG = "elvonix-chunk-reload";
const CHUNK_ERROR_RE = /ChunkLoadError|Loading chunk .* failed|Failed to fetch dynamically imported module|error loading dynamically imported module/i;

function reloadOnce() {
  try {
    if (sessionStorage.getItem(RELOAD_FLAG)) return;
    sessionStorage.setItem(RELOAD_FLAG, "1");
  } catch {
    // sessionStorage를 못 쓰는 환경(프라이빗 모드 등)이면 그냥 한 번 시도한다.
  }
  window.location.reload();
}

export function ChunkErrorReload() {
  useEffect(() => {
    function handleError(event: ErrorEvent) {
      if (CHUNK_ERROR_RE.test(event.message ?? "")) reloadOnce();
    }
    function handleRejection(event: PromiseRejectionEvent) {
      const reason = event.reason;
      const text = typeof reason === "string" ? reason : (reason?.message ?? reason?.name ?? "");
      if (CHUNK_ERROR_RE.test(text)) reloadOnce();
    }
    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);
    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  return null;
}
