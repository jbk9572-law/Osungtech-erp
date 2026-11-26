import { headers } from "next/headers";

// 포털 전용 서브도메인(PORTAL_HOSTNAME)에서는 /portal이 이미 호스트명으로
// 대체돼 있어서(src/proxy.ts가 들어오는 요청만 내부적으로 /portal/*로
// 리라이트한다) 화면 안의 링크/redirect()까지 "/portal" 접두어를 그대로
// 쓰면, 주소창에 처음엔 숨었던 "/portal"이 한 번 클릭한 뒤부턴 다시
// 보이게 된다. 포털 화면의 모든 Link href/redirect() 목적지는 이 함수를
// 거쳐야 양쪽 호스트(기존 메인 도메인의 /portal/*, 분리된 포털
// 서브도메인) 모두에서 깨지지 않고 주소가 일관되게 보인다.
export async function portalHref(path: string): Promise<string> {
  const portalHost = process.env.PORTAL_HOSTNAME;
  if (!portalHost) return `/portal${path}`;

  const hostHeader = (await headers()).get("host") ?? "";
  // 포트가 붙어있을 수 있는 로컬 개발 환경(예: "localhost:3000")도
  // 고려해 호스트명만 비교한다.
  const hostname = hostHeader.split(":")[0];
  return hostname === portalHost ? path || "/" : `/portal${path}`;
}

// 거래처·하청업체에게 알려 줄 "포털 로그인 주소" — 전용 주소(PORTAL_HOSTNAME)가 켜져 있으면 그 주소, 아니면 지금 접속한 주소의 /portal/login.
// 어느 쪽이든 "지금 실제로 열리는 주소"라서 화면의 [열기]·[주소 복사]가 항상 맞다. dedicated=false면 화면이 작은 안내를 덧붙인다.
export async function portalLoginUrl(): Promise<{ url: string; dedicated: boolean }> {
  const portalHost = process.env.PORTAL_HOSTNAME;
  if (portalHost) return { url: `https://${portalHost}/login`, dedicated: true };
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return { url: `${proto}://${host}/portal/login`, dedicated: false };
}
