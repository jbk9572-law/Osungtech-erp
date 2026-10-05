import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// 거래처 포털 전용 서브도메인(예: portal.elvonix.co.kr) — 환경변수가
// 설정돼 있을 때만 아래 분기가 켜진다. Netlify에 그 도메인을 별칭으로
// 등록하고 PORTAL_HOSTNAME을 설정하기 전까지는 이 파일이 하는 일이
// 전혀 없고 기존 그대로(/portal/* 경로로 접속) 동작한다 — 안전하게 켤
// 수 있는 기능 플래그다.
//
// 내부 직원 로그인과 거래처 포털 로그인이 같은 도메인·같은 Supabase
// 인증 쿠키를 공유해서, 같은 브라우저로 직원이 포털을 테스트해보면
// 자기도 모르게 직원 세션이 로그아웃되는 문제가 있었다 — 쿠키는
// 기본적으로 그 쿠키를 심은 호스트명에만 묶이므로(도메인을 명시적으로
// 지정한 적이 없다, src/lib/supabase/server.ts/proxy.ts 참고), 포털을
// 아예 다른 호스트명으로 분리하면 추가 코드 없이 세션이 자연히
// 갈린다.
const PORTAL_HOSTNAME = process.env.PORTAL_HOSTNAME;

export async function proxy(request: NextRequest) {
  const hostname = request.headers.get("host") ?? request.nextUrl.hostname;

  if (PORTAL_HOSTNAME && hostname === PORTAL_HOSTNAME) {
    // portal.elvonix.co.kr/login → 내부적으로 /portal/login을 그대로
    // 서빙한다(주소창은 안 바뀜). PUBLIC_PATHS 판단·리다이렉트 목적지
    // 전부 이 "서빙될 실제 경로" 기준이어야 해서, updateSession을
    // 부르기 전에 미리 경로를 바꿔둔다.
    if (!request.nextUrl.pathname.startsWith("/portal")) {
      request.nextUrl.pathname = `/portal${request.nextUrl.pathname === "/" ? "" : request.nextUrl.pathname}`;
    }
    const sessionResponse = await updateSession(request);
    if (sessionResponse.headers.get("location")) return sessionResponse;

    // updateSession()이 돌려준 응답은 세션 갱신 쿠키(Set-Cookie)만 담은
    // NextResponse.next(...)라 그 자체로는 경로를 바꾸지 못한다(next()는
    // 요청 헤더만 전달할 뿐 실제로 어느 라우트를 렌더링할지는 안 바꾼다)
    // — 실제 리라이트는 NextResponse.rewrite()로 따로 수행하고, 거기에
    // 세션 쿠키만 옮겨 싣는다.
    const rewritten = NextResponse.rewrite(request.nextUrl, { request });
    sessionResponse.cookies.getAll().forEach((cookie) => rewritten.cookies.set(cookie));
    return rewritten;
  }

  if (PORTAL_HOSTNAME && hostname !== PORTAL_HOSTNAME && request.nextUrl.pathname.startsWith("/portal")) {
    // 직원용 도메인으로 /portal/*에 들어오면 이제 전용 주소로 영구
    // 리다이렉트한다 — 거래처에게 안내할 주소가 하나로 통일된다.
    const url = new URL(request.url);
    url.hostname = PORTAL_HOSTNAME;
    url.pathname = request.nextUrl.pathname.slice("/portal".length) || "/";
    return NextResponse.redirect(url, 308);
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
