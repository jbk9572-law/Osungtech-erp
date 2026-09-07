import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// "/demo"는 아이디/비밀번호 입력 없이 데모 계정으로 자동 로그인시켜주는
// 진입점(src/app/demo/route.ts)이라, 로그인 전 상태에서도 이 경로 자체는
// 통과시켜야 한다 — 그러지 않으면 로그인 안 된 방문자가 /demo에 도달하기도
// 전에 /login으로 튕겨나간다. 로그인 처리 자체는 그 라우트 핸들러 안에서
// 이뤄지고, 성공하면 /dashboard로 리다이렉트되어 그 다음부터는 이미 로그인된
// 상태로 나머지 화면을 통과한다.
const PUBLIC_PATHS = ["/login", "/auth", "/demo"];

export async function updateSession(request: NextRequest) {
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isPublicPath = PUBLIC_PATHS.some((path) => pathname.startsWith(path));

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}
