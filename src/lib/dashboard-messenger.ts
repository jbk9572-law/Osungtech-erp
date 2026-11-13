import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { isFeatureEnabled } from "@/lib/require-feature-enabled";
import { mailTimeLabel } from "@/lib/dashboard-mail";
import type { ChatInput } from "@/lib/dashboard-todo";

// 메인 화면 "메신저" — 안 읽은 대화(채널별 가장 최근 메시지 + 안 읽은 개수). 읽음 시각은 메신저 화면에서 대화를
// 열 때 저장된다(migration 236). 메신저 기능을 끈 회사는 available=false라 선택 목록에서도 빠진다.
export type DashboardMessenger = { available: boolean; items: ChatInput[] };

export async function getDashboardMessenger(
  supabase: SupabaseClient<Database>,
  userId: string | null,
  withItems: boolean,
): Promise<DashboardMessenger> {
  if (!userId || !(await isFeatureEnabled(supabase, "messenger"))) return { available: false, items: [] };
  if (!withItems) return { available: true, items: [] };
  const { data, error } = await supabase.rpc("get_messenger_unread", { p_limit: 8 });
  if (error) {
    console.error("메신저 안 읽은 대화 조회 실패:", error.message);
    return { available: true, items: [] };
  }
  return {
    available: true,
    items: (data ?? []).map((r) => ({
      channelId: r.channel_id,
      label: r.channel_label,
      sender: r.last_sender_name?.trim() || "시스템",
      content: (r.last_content ?? "").trim() || "(첨부 파일)",
      unreadCount: Number(r.unread_count),
      timeLabel: mailTimeLabel(r.last_at),
    })),
  };
}
