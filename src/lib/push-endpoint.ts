// 웹푸시 구독 endpoint는 서버가 알림을 보낼 때마다 POST하는 주소다. 아무 주소나 저장하게 두면 직원이 사내 HTTPS 주소를 넣어
// 서버발 요청을 만들고 응답 코드(404/410이면 구독 삭제)로 내부 서비스 존재 여부를 알아낼 수 있다(SSRF 오라클).
// 그래서 브라우저가 실제로 쓰는 푸시 서비스 도메인만 받는다.
const PUSH_HOST_SUFFIXES = ["fcm.googleapis.com", "updates.push.services.mozilla.com", "push.services.mozilla.com", "notify.windows.com", "push.apple.com"];

export function isSafePushEndpoint(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) return false;
  const host = url.hostname.toLowerCase();
  return PUSH_HOST_SUFFIXES.some((s) => host === s || host.endsWith(`.${s}`));
}
