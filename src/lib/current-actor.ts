import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// 매출/매입/할일/공지사항 상세·수정 화면에서 "이 문서를 지금 보고 있는
// 내가 수정/삭제할 수 있는 사람인가"를 판정할 때 공통으로 쓰는 조회.
// requireAdmin()과 달리 페이지가 이미 만들어둔 supabase 클라이언트를
// 그대로 받는다 — 같은 요청 안에서 클라이언트를 중복 생성하지 않기 위함.
export async function getCurrentActor(
  supabase: SupabaseServerClient
): Promise<{ userId: string | null; isAdmin: boolean }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { userId: null, isAdmin: false };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  return { userId: user.id, isAdmin: profile?.role === "admin" };
}
