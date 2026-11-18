"use client";

// 오류 화면(error.tsx)이 뜬 순간 브라우저가 호출한다: (1) 오류를 서버 오류 기록으로 보고하고(/api/client-error),
// (2) 배포 직후 열려 있던 낡은 화면이 새 서버와 맞지 않아 생긴 오류("An unexpected response was received from the server" 등)면
// 한 번만 자동으로 새로고침해 새 화면으로 바꿔 준다(무한 반복 방지: 60초 안에는 다시 하지 않음).
const RELOAD_KEY = "erp-skew-reload-at";
const SKEW_PATTERN = /unexpected response was received from the server|Failed to find Server Action|older or newer deployment|ChunkLoadError|Loading chunk/i;

export function reportClientError(error: Error & { digest?: string }): void {
  try {
    const body = JSON.stringify({
      message: `${error.name}: ${error.message}`.slice(0, 1000),
      digest: error.digest,
      path: window.location.pathname,
    });
    if (navigator.sendBeacon) navigator.sendBeacon("/api/client-error", new Blob([body], { type: "application/json" }));
    else void fetch("/api/client-error", { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } });
  } catch {
    // 보고 실패는 무시
  }
  try {
    if (SKEW_PATTERN.test(`${error.name} ${error.message}`)) {
      const last = Number(window.sessionStorage.getItem(RELOAD_KEY) ?? 0);
      if (Date.now() - last > 60_000) {
        window.sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
        window.location.reload();
      }
    }
  } catch {
    // sessionStorage 를 못 쓰면 자동 새로고침만 건너뛴다.
  }
}
