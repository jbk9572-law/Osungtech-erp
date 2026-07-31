import { createClient } from "@/lib/supabase/server";

// API 라우트(/api/**)는 proxy.ts(미들웨어)가 비로그인 요청을 /login으로
// 리다이렉트해주는 것에 의존하고 있었다 — 오늘은 맞지만, PUBLIC_PATHS나
// 매처 설정이 나중에 바뀌면 조용히 뚫릴 수 있는 단일 방어선이라 각 라우트
// 안에서도 명시적으로 한 번 더 확인한다(defense in depth).
export async function requireAuthedApiUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}
