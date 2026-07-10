import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export type AnnouncementNotice = { id: string; title: string; pinned: boolean };
export type TodoNotice = { id: string; title: string; due_date: string | null };

// 타이틀바 알림 종/대시보드 배너/알림 팝업이 공유하는 "지금 확인해야 할 것" 조회 로직.
// 안 읽은 공지사항 + 마감 3일 이내인 미완료 할일을 가져온다. 마감일이 이미
// 지난 할일은 자동으로 완료 처리해 알림에 계속 반복해서 뜨지 않게 한다.
export async function getNotificationSummary(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<{ announcements: AnnouncementNotice[]; todos: TodoNotice[] }> {
  const today = new Date();
  const todayStr = today.toLocaleDateString("sv-SE");
  const soonDate = new Date();
  soonDate.setDate(soonDate.getDate() + 3);
  const soonStr = soonDate.toLocaleDateString("sv-SE");

  const [{ data: announcements }, { data: reads }, { data: dueTodos }] = await Promise.all([
    supabase
      .from("announcements")
      .select("id, title, pinned, created_at")
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(30),
    supabase.from("announcement_reads").select("announcement_id").eq("user_id", userId),
    supabase
      .from("todos")
      .select("id, title, due_date")
      .eq("done", false)
      .lte("due_date", soonStr)
      .order("due_date", { ascending: true })
      .limit(20),
  ]);

  const readIds = new Set((reads ?? []).map((r) => r.announcement_id));
  const unreadAnnouncements = (announcements ?? [])
    .filter((a) => !readIds.has(a.id))
    .slice(0, 8)
    .map((a) => ({ id: a.id, title: a.title, pinned: a.pinned }));

  const overdueIds = (dueTodos ?? [])
    .filter((t) => t.due_date && t.due_date < todayStr)
    .map((t) => t.id);
  if (overdueIds.length > 0) {
    await supabase
      .from("todos")
      .update({ done: true, done_at: new Date().toISOString() })
      .in("id", overdueIds);
  }
  const activeTodos = (dueTodos ?? []).filter((t) => !(t.due_date && t.due_date < todayStr));

  return { announcements: unreadAnnouncements, todos: activeTodos };
}
