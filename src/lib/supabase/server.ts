import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database.types";

// react의 cache()로 감싸서, 같은 요청(레이아웃 + 페이지 + 그 안에서 호출되는
// 여러 헬퍼) 안에서 createClient()를 몇 번을 부르든 항상 같은 클라이언트
// 인스턴스를 돌려받는다 — Supabase 공식 Next.js App Router 가이드가 권장하는
// 패턴. 이렇게 해야 아래 getUser()도 "같은 요청 안에서는 한 번만 실제로
// 검증한다"는 걸 보장할 수 있다(클라이언트 인스턴스가 매번 다르면
// cache()가 서로 다른 인자로 보고 중복 제거를 못 한다).
export const createClient = cache(async () => {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Called from a Server Component; ignore since proxy.ts
            // refreshes the session on every request.
          }
        },
      },
    }
  );
});

// supabase.auth.getUser()는 로컬 쿠키만 읽는 게 아니라 매번 Supabase Auth
// 서버에 실제로 검증 요청을 보낸다(보안상 의도된 동작 — getSession()과
// 달리 위조된 쿠키를 걸러낼 수 있다). 그런데 미들웨어(proxy.ts)에서 한 번,
// 레이아웃에서 한 번, 페이지 안에서 또, requireAdmin/getCurrentActor 등에서
// 또 — 이런 식으로 같은 요청 안에서 이 검증이 여러 번 겹쳐 호출되고
// 있었다. cache()로 감싸 같은 요청 안에서는 실제 네트워크 호출이 한 번만
// 나가고 나머지는 그 결과를 재사용하게 한다(미들웨어는 렌더 트리 밖의
// 별도 실행 단계라 이 캐시를 공유하지 못해 그쪽 호출 1회는 그대로 남는다).
//
// 이 함수는 (dashboard)/layout.tsx를 통해 사실상 모든 화면 렌더링마다
// 호출되는데, 실제 네트워크 호출이라 Supabase Auth 서버로의 요청이
// 일시적으로 실패(순단, 타임아웃)할 수 있다 — proxy.ts의 미들웨어 호출은
// 이미 try/catch로 감싸뒀지만 이 함수는 안 감싸져 있었다. 여기서 예외가
// 나면 그 요청의 레이아웃 렌더링 자체가 통째로 실패해 (dashboard)/
// error.tsx 경계로 떨어지는데, "특정 메뉴만 자주 크래시난다"는 제보 중
// 상당수가 실제로는 화면마다 다른 버그가 아니라 이 공용 함수 하나의
// 일시적 실패였을 가능성이 크다 — 로그인 자체가 안 된 것과 같은 뜻이므로
// null을 돌려줘 호출부(requireAdmin 등)가 로그인 화면으로 보내게 한다.
export const getUser = cache(async () => {
  const supabase = await createClient();
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch {
    return null;
  }
});
