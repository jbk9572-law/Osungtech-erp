import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// "/demo"는 아이디/비밀번호 입력 없이 데모 계정으로 자동 로그인시켜주는
// 진입점(src/app/demo/route.ts)이라, 로그인 전 상태에서도 이 경로 자체는
// 통과시켜야 한다 — 그러지 않으면 로그인 안 된 방문자가 /demo에 도달하기도
// 전에 /login으로 튕겨나간다. 로그인 처리 자체는 그 라우트 핸들러 안에서
// 이뤄지고, 성공하면 /dashboard로 리다이렉트되어 그 다음부터는 이미 로그인된
// 상태로 나머지 화면을 통과한다.
// "/api/calendar/feed"는 외부 캘린더 앱(구글/아웃룩 등)이 로그인 세션 없이
// URL에 담긴 개인별 비밀 토큰만으로 주기적으로 요청하는 ICS 구독 피드라,
// 이 경로 자체는 통과시켜야 한다 — 인증은 그 라우트 핸들러 안에서 토큰으로
// 직접 확인한다(src/app/api/calendar/feed/route.ts).
// "/api/cron"은 GitHub Actions 스케줄이 로그인 세션 없이 Authorization:
// Bearer 헤더(CRON_SECRET)만으로 주기적으로 부르는 엔드포인트들
// (mail-sync, messenger-alerts, warmup)이다 — 여기 없으면 세션 없는
// 요청이 /login으로 리다이렉트되고 라우트 핸들러(CRON_SECRET 검증 포함)
// 자체가 전혀 실행되지 않는다. GitHub Actions의 curl은 -L(리다이렉트
// 따라가기) 없이 호출해서 307을 "성공"으로 잘못 보고하고 넘어가므로,
// 아무도 모르게 크론이 계속 아무 일도 안 하고 있었을 수 있다 — 발견
// 즉시 수정. 인증은 각 라우트 핸들러 안에서 CRON_SECRET으로 직접
// 확인한다(/api/calendar/feed와 동일한 패턴).
// "/signup"은 공개 회원가입 화면이라 로그인 전 상태에서 접근 가능해야 한다.
// "/terms"/"/privacy"는 로그인 화면 자체(비로그인 상태)에서 링크로 노출되는
// 약관/개인정보처리방침 화면인데 여기 빠져 있어서 클릭하면 /login으로
// 되튕겨나가는 버그가 있었다 — 같은 "로그인 화면에서 링크로 노출되는데
// PUBLIC_PATHS엔 없는" 패턴이라 같이 고친다.
// "/portal"은 거래처/업체(하청) 포털 전용 영역 — 내부 직원 로그인
// (auth.users의 다른 계정)과 완전히 분리된 자기 로그인 화면
// (/portal/login)을 갖고 있고, 실제 접근 제어는 portal/(app)/layout.tsx가
// portal_identity()로 직접 한다. 여기 안 넣으면, 사내 직원 세션이 전혀
// 없는 "처음 방문하는 거래처/업체"가 /portal/login에 들어오는 순간
// (user가 없고 PUBLIC_PATHS에도 없어서) 엉뚱하게 직원용 /login으로
// 튕겨나가는 버그가 난다 — 이 세션 안에서는 계속 직원으로 로그인된 채
// 테스트해서 못 보고 지나갔던 경로다.
const PUBLIC_PATHS = ["/login", "/signup", "/auth", "/demo", "/api/calendar/feed", "/api/cron", "/terms", "/privacy", "/portal"];

export async function updateSession(request: NextRequest) {
  // 공개 경로(/login 등)는 로그인 안 된 사람을 /login으로 보내는
  // 아래 리다이렉트 분기 자체가 적용될 이유가 없다(이미 공개 화면이니
  // 막을 게 없다) — 그런데도 예전엔 이 판단을 하기도 전에
  // supabase.auth.getUser()부터 먼저 불러서, 결과를 안 쓸 요청에도 매번
  // Supabase Auth 서버 왕복(로컬 쿠키 디코딩이 아니라 실제 네트워크
  // 검증)을 하고 있었다 — 로그인 화면으로 이동하는 것조차 느리다는
  // 지적이 바로 이 낭비 때문이었다. pathname부터 먼저 확인해서, 공개
  // 경로면 Supabase 클라이언트를 만들거나 getUser()를 부르지도 않고
  // 바로 통과시킨다.
  const pathname = request.nextUrl.pathname;
  const isPublicPath = PUBLIC_PATHS.some((path) => pathname.startsWith(path));

  if (isPublicPath) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // 미들웨어는 정적 파일(manifest.webmanifest 등)을 뺀 거의 모든 요청을
  // 지나가므로, 여기서 예외가 나면 그 요청 하나가 아니라 화면 렌더링
  // 자체가 통째로 막힌다 — Supabase Auth API가 순간적으로 응답이 늦거나
  // 네트워크가 잠깐 끊기면(드물지만 항상 있을 수 있는 일) getUser()가
  // 던지는 예외를 아무도 안 잡고 있어서, 그 순간 떠 있던 여러 화면이
  // 동시에 "일시적인 오류"로 보였다(재고실사 크래시와 같은 순간 manifest.
  // webmanifest 요청까지 깨진 게 그 증거 — 서로 무관한 두 요청이 같이
  // 실패한 건 미들웨어라는 공통 지점이 원인이라는 뜻이다). 실패하면
  // "로그인 안 된 사람"으로 fail-closed 처리한다 — 보호된 화면이면
  // 로그인으로 보내고, 이미 열려있던 요청은 다음 재시도에서 복구된다.
  //
  // getUser()가 아니라 getClaims()를 쓴다 — 둘 다 "로그인 안 된
  // 사람"을 걸러내기 위해 매 요청(이 앱의 보호된 경로 전부)마다 호출
  // 되는데, getUser()는 항상 Supabase Auth 서버로 네트워크 왕복을
  // 보낸다. getClaims()는 프로젝트가 비대칭(ECC/RSA) JWT 서명을 쓰면
  // JWKS(서명 검증용 공개키, 자체적으로 엣지 캐싱됨)로 로컬에서
  // 서명을 검증해 대부분 왕복 없이 끝난다 — getSession()처럼 서명
  // 검증을 건너뛰고 쿠키를 그냥 믿는 방식이 아니라 실제로 암호학적
  // 검증을 하므로 getUser() 대비 보안 수준을 낮추지 않는다(대칭 키
  // 프로젝트거나 WebCrypto가 없으면 자동으로 getUser()와 동일하게
  // 서버 왕복으로 폴백 — 그래도 지금보다 느려지지는 않는다). 전체
  // 요청의 첫 관문에서 겪던 네트워크 왕복을 없애는 게 목적이라,
  // 이미 네트워크 호출인 레이아웃 쪽 getUser()(react cache()로 요청당
  // 1회로 묶여 있음, src/lib/supabase/server.ts)는 그대로 둔다 —
  // 그쪽은 user.id/email 등 전체 객체가 실제로 필요해서 바꾸려면 호출부
  // 전체를 다시 손봐야 하는 별도 작업이다.
  let hasValidSession = false;
  try {
    const { data, error: claimsError } = await supabase.auth.getClaims();
    hasValidSession = !claimsError && !!data?.claims?.sub;
  } catch {
    hasValidSession = false;
  }

  if (!hasValidSession) {
    // 위치 QR처럼 로그인 안 된 상태에서 특정 화면 링크로 바로 들어오는
    // 경우, 로그인 후 무조건 /dashboard로 보내면 원래 보려던 화면을
    // 다시 찾아가야 한다 — 원래 경로를 next로 넘겨 로그인 액션이 그
    // 위치로 되돌려보내게 한다.
    const originalPath = `${pathname}${request.nextUrl.search}`;
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", originalPath);
    return NextResponse.redirect(url);
  }

  return response;
}
