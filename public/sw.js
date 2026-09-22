// 홈 화면에 설치(PWA)만 가능하게 하는 최소 서비스워커. ERP 특성상 인증/재고
// 데이터가 계속 바뀌므로 어떤 요청도 캐싱하지 않는다 — 오프라인 지원이나
// 캐시 전략은 지금 필요하지 않고, "설치 가능" 조건만 만족시키면 된다.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // 네트워크로 그대로 통과시킨다(캐시 없음) — respondWith를 호출하지
  // 않으면 브라우저 기본 처리로 넘어간다.
});
