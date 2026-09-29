import { createClient } from "@/lib/supabase/server";
import { safeQuery } from "@/lib/safe-query";
import { isFeatureEnabled } from "@/lib/require-feature-enabled";
import { MessengerWidget, type MailPreviewItem, type NotificationItem } from "@/components/erp/messenger-widget";
import type { MessengerChannel } from "@/lib/messenger-types";

// 최근 메신저 메시지 100건 조회를 (dashboard)/layout.tsx의 메인
// Promise.all에서 분리했다 — usage-widget/notification-bell과 같은
// 이유: 페이지 이동마다 항상 같이 돌던 조회 하나를 줄여 요청당 CPU
// 부담을 낮춘다. profileNames/currentUserId는 layout.tsx가 이미(같은
// 요청 안에서) profiles를 가져온 김에 그대로 넘겨받는다 — isDemo
// 판별에도 그 값이 필요해서 profiles 조회 자체는 메인 경로에 남겨뒀다.
export async function MessengerWidgetPanel({
  profileNames,
  currentUserId,
  isAdmin,
}: {
  profileNames: Record<string, string>;
  currentUserId: string;
  isAdmin: boolean;
}) {
  const supabase = await createClient();

  const mailEnabled = await isFeatureEnabled(supabase, "mail");

  // allChannelId/mailAccount는 그 뒤 조회들(메시지/메일 미리보기)의 필터
  // 값으로 쓰여야 해서 먼저 구해둔다.
  const [{ data: allChannelId }, { data: mailAccount }] = await Promise.all([
    safeQuery<string>(supabase.rpc("get_or_create_all_channel")),
    mailEnabled
      ? safeQuery<{ id: string }>(
          supabase.from("mail_accounts").select("id").eq("user_id", currentUserId).maybeSingle(),
        )
      : Promise.resolve({ data: null }),
  ]);

  const [
    { data: channelRows },
    { data: memberRows },
    { data: messages },
    { data: mailPreviewRows },
    { count: mailUnreadCount },
    { data: notificationRows },
    { count: notifUnreadCount },
  ] = await Promise.all([
    safeQuery<{ id: string; type: string; name: string | null }[]>(
      supabase
        .from("messenger_channels")
        .select("id, type, name")
        .order("created_at", { ascending: true })
        .limit(500),
    ),
    safeQuery<{ channel_id: string; user_id: string }[]>(
      supabase.from("messenger_channel_members").select("channel_id, user_id").limit(2000),
    ),
    allChannelId
      ? safeQuery<
          {
            id: string;
            channel_id: string;
            sender_id: string | null;
            content: string;
            file_url: string | null;
            file_path: string | null;
            file_name: string | null;
            file_size: number | null;
            created_at: string;
          }[]
        >(
          supabase
            .from("messenger_messages")
            .select("id, channel_id, sender_id, content, file_url, file_path, file_name, file_size, created_at")
            .eq("channel_id", allChannelId)
            // 최신 100건을 가져온 뒤(내림차순), 화면에는 예전 메시지가 위로
            // 오는 순서로 보여줘야 하므로 다시 뒤집는다.
            .order("created_at", { ascending: false })
            .limit(100),
        )
      : Promise.resolve({ data: null }),
    mailAccount
      ? safeQuery<
          { id: string; subject: string | null; from_name: string | null; from_address: string | null; sent_at: string | null; is_read: boolean }[]
        >(
          supabase
            .from("mail_messages")
            .select("id, subject, from_name, from_address, sent_at, is_read")
            .eq("mail_account_id", mailAccount.id)
            .eq("folder", "INBOX")
            .order("sent_at", { ascending: false, nullsFirst: false })
            .limit(8),
        )
      : Promise.resolve({ data: null }),
    mailAccount
      ? supabase
          .from("mail_messages")
          .select("id", { count: "exact", head: true })
          .eq("mail_account_id", mailAccount.id)
          .eq("folder", "INBOX")
          .eq("is_read", false)
          .then(
            (r) => r,
            () => ({ count: 0 }),
          )
      : Promise.resolve({ count: 0 }),
    safeQuery<
      { id: string; type: string; title: string; body: string | null; url: string | null; is_read: boolean; created_at: string }[]
    >(
      supabase
        .from("notification_events")
        .select("id, type, title, body, url, is_read, created_at")
        .eq("user_id", currentUserId)
        .order("created_at", { ascending: false })
        .limit(20),
    ),
    supabase
      .from("notification_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", currentUserId)
      .eq("is_read", false)
      .then(
        (r) => r,
        () => ({ count: 0 }),
      ),
  ]);

  const membersByChannel = new Map<string, string[]>();
  for (const m of memberRows ?? []) {
    const list = membersByChannel.get(m.channel_id) ?? [];
    list.push(m.user_id);
    membersByChannel.set(m.channel_id, list);
  }

  const channels: MessengerChannel[] = (channelRows ?? []).map((c) => ({
    id: c.id,
    type: c.type as MessengerChannel["type"],
    name: c.name,
    memberIds: membersByChannel.get(c.id) ?? [],
  }));

  const mailPreview: MailPreviewItem[] = (mailPreviewRows ?? []).map((m) => ({
    id: m.id,
    subject: m.subject,
    fromName: m.from_name,
    fromAddress: m.from_address,
    sentAt: m.sent_at,
    isRead: m.is_read,
  }));

  const notifications: NotificationItem[] = (notificationRows ?? []).map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    url: n.url,
    isRead: n.is_read,
    createdAt: n.created_at,
  }));

  return (
    <MessengerWidget
      channels={channels}
      activeChannelId={allChannelId ?? channels[0]?.id ?? null}
      initialMessages={(messages ?? []).slice().reverse()}
      profileNames={profileNames}
      currentUserId={currentUserId}
      isAdmin={isAdmin}
      mailEnabled={mailEnabled && !!mailAccount}
      initialMailPreview={mailPreview}
      initialMailUnreadCount={mailUnreadCount ?? 0}
      initialNotifications={notifications}
      initialNotifUnreadCount={notifUnreadCount ?? 0}
    />
  );
}
