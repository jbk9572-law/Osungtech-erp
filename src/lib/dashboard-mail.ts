import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { isFeatureEnabled } from "@/lib/require-feature-enabled";
import type { MailInput } from "@/lib/dashboard-todo";

// 메인 화면 "받은 메일" — 이미 DB에 동기화된 받은편지함(mail_messages)에서 내 계정의 읽지 않은 메일만
// 최근순으로 가져온다(메일 서버를 직접 부르지 않아 메인 화면이 느려지지 않는다). 메일 기능을 껐거나 연동된
// 계정이 없으면 available=false라 내용 고르기 목록에서도 빠진다. 내 메일이 아닌 건 RLS와 계정 조건으로 막는다.
const MAIL_LIMIT = 8;

// syncNote: 메일은 서버에서 가져와 저장해 둔 것을 보여주므로, 언제 마지막으로 가져왔는지(또는 오류)를 탭 아래에 알려준다.
export type DashboardMail = { available: boolean; items: MailInput[]; sentItems: MailInput[]; syncNote: string | null };

export async function getDashboardMail(
  supabase: SupabaseClient<Database>,
  userId: string | null,
  want: { inbox: boolean; sent: boolean },
): Promise<DashboardMail> {
  if (!userId) return { available: false, items: [], sentItems: [], syncNote: null };
  const [enabled, accountRes] = await Promise.all([
    isFeatureEnabled(supabase, "mail"),
    supabase.from("mail_accounts").select("id, last_synced_at, last_sync_error").eq("user_id", userId).maybeSingle(),
  ]);
  const account = accountRes.data;
  if (!enabled || !account) return { available: false, items: [], sentItems: [], syncNote: null };
  const syncNote = syncNoteOf(account.last_synced_at, account.last_sync_error);
  if (!want.inbox && !want.sent) return { available: true, items: [], sentItems: [], syncNote };

  const [inbox, sent] = await Promise.all([
    want.inbox
      ? supabase
          .from("mail_messages")
          .select("id, subject, from_name, from_address, sent_at")
          .eq("mail_account_id", account.id)
          .eq("folder", "INBOX")
          .eq("is_read", false)
          .order("sent_at", { ascending: false, nullsFirst: false })
          .limit(MAIL_LIMIT)
      : Promise.resolve({ data: [] as { id: string; subject: string | null; from_name: string | null; from_address: string | null; sent_at: string | null }[] }),
    want.sent
      ? supabase
          .from("mail_messages")
          .select("id, subject, to_addresses, sent_at")
          .eq("mail_account_id", account.id)
          .eq("folder", "SENT")
          .order("sent_at", { ascending: false, nullsFirst: false })
          .limit(MAIL_LIMIT)
      : Promise.resolve({ data: [] as { id: string; subject: string | null; to_addresses: unknown; sent_at: string | null }[] }),
  ]);

  return {
    available: true,
    syncNote,
    items: (inbox.data ?? []).map((m) => ({
      id: m.id,
      subject: m.subject?.trim() || "(제목 없음)",
      fromName: m.from_name?.trim() || m.from_address || "보낸 사람 없음",
      sentLabel: mailTimeLabel(m.sent_at),
    })),
    sentItems: (sent.data ?? []).map((m) => ({
      id: m.id,
      subject: m.subject?.trim() || "(제목 없음)",
      fromName: recipientLabel(m.to_addresses),
      sentLabel: mailTimeLabel(m.sent_at),
    })),
  };
}

// "메일함 마지막 확인 14:20" — 오류가 있으면 그 사실을, 아직 한 번도 못 가져왔으면 그렇게 알려준다.
export function syncNoteOf(lastSyncedAt: string | null, lastError: string | null): string {
  if (lastError) return "메일 서버 연결에 문제가 있어 새 메일을 가져오지 못하고 있습니다(환경설정 > 메일 계정 연동 확인).";
  const label = mailTimeLabel(lastSyncedAt);
  return label ? `메일함 마지막 확인 ${label}` : "아직 메일을 가져오지 않았습니다.";
}

// 보낸 메일의 받는 사람 — 첫 사람 이름(없으면 주소) 외 N명.
export function recipientLabel(raw: unknown): string {
  const list = Array.isArray(raw) ? (raw as { name?: string | null; email?: string | null }[]) : [];
  const first = list[0];
  if (!first) return "받는 사람 없음";
  const name = first.name?.trim() || first.email || "받는 사람 없음";
  return list.length > 1 ? `${name} 외 ${list.length - 1}명` : name;
}

// 오늘 온 메일은 시각("10:42"), 이전 메일은 월/일("11/11")로 — 한국 시간 기준.
export function mailTimeLabel(sentAt: string | null, now: Date = new Date()): string {
  if (!sentAt) return "";
  const d = new Date(sentAt);
  if (Number.isNaN(d.getTime())) return "";
  const fmt = (date: Date, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour12: false, ...opts }).format(date);
  const day = (date: Date) => fmt(date, { year: "numeric", month: "2-digit", day: "2-digit" });
  if (day(d) === day(now)) return fmt(d, { hour: "2-digit", minute: "2-digit" });
  return fmt(d, { month: "numeric", day: "numeric" }).replace(/\s/g, "").replace(".", "/").replace(".", "");
}
