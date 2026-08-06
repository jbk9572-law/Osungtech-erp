import { createClient } from "@/lib/supabase/server";

// 관리자 전용 Server Action에서 공통으로 쓰는 권한 체크. settings/users/actions.ts에서
// 계정 관리용으로 먼저 쓰던 걸 회사 설정(로고/사업자정보) 등 다른 관리자 전용
// 화면에서도 재사용할 수 있게 분리했다.
export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, isAdmin: false, selfId: null as string | null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  return { supabase, isAdmin: profile?.role === "admin", selfId: user.id };
}
