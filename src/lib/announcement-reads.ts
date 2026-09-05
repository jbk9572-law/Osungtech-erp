import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// 공지 읽음 처리(upsert)가 상세화면 열람 시(자동)와 목록 체크박스(수동) 두
// 곳에서 각각 인라인으로 복붙돼 있었다 — 나중에 읽음 규칙이 바뀌면(예:
// read_at 타임스탬프 추가) 한쪽만 고치고 다른 쪽을 빠뜨리기 쉬워 하나로
// 합친다.
export async function markAnnouncementRead(
  supabase: SupabaseServerClient,
  announcementId: string,
  userId: string
) {
  return supabase
    .from("announcement_reads")
    .upsert({ announcement_id: announcementId, user_id: userId }, { onConflict: "announcement_id,user_id" });
}
