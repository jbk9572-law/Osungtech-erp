// 홈 화면에 설치(PWA) + 결재 요청/승인/반려 푸시 알림을 담당하는 최소
// 서비스워커. ERP 특성상 인증/재고 데이터가 계속 바뀌므로 어떤 요청도
// 캐싱하지 않는다 — 오프라인 지원이나 캐시 전략은 필요하지 않다.
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

// src/lib/push-notify.ts가 보내는 payload: { title, body, url }.
self.addEventListener("push", (event) => {
  let payload = { title: "ELVONIX ERP", body: "새 알림이 있습니다.", url: "/dashboard" };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    // 파싱 실패해도 기본 문구로 표시한다.
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icon-192.png",
      data: { url: payload.url },
    }),
  );
});

// 알림을 클릭하면 이미 열려있는 탭이 있으면 그 탭으로 포커스하고
// 이동시키고, 없으면 새 탭을 연다.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/dashboard";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
