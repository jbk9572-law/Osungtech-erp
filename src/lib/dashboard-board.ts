import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { BoardInput } from "@/lib/dashboard-todo";

// 메인 화면 "최근 공지" — 읽었든 안 읽었든 가장 최근 공지·게시글(고정글 먼저). "읽지 않은 공지" 탭과 달리 이미 읽은 글도 다시 훑어볼 수 있다.
export async function getRecentBoard(supabase: SupabaseClient<Database>): Promise<BoardInput[]> {
  const { data } = await supabase
    .from("announcements")
    .select("id, title, pinned, created_at")
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(8);
  return (data ?? []).map((a) => ({ id: a.id, title: a.title, pinned: a.pinned, createdAt: a.created_at }));
}
