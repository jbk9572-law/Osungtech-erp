import { createClient } from "@/lib/supabase/server";
import { MessengerWidget } from "@/components/erp/messenger-widget";
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

  const { data: allChannelId } = await supabase.rpc("get_or_create_all_channel");

  const [{ data: channelRows }, { data: memberRows }, { data: messages }] = await Promise.all([
    supabase
      .from("messenger_channels")
      .select("id, type, name")
      .order("created_at", { ascending: true })
      .limit(500),
    supabase.from("messenger_channel_members").select("channel_id, user_id").limit(2000),
    allChannelId
      ? supabase
          .from("messenger_messages")
          .select("id, channel_id, sender_id, content, file_url, file_path, file_name, file_size, created_at")
          .eq("channel_id", allChannelId)
          // 최신 100건을 가져온 뒤(내림차순), 화면에는 예전 메시지가 위로
          // 오는 순서로 보여줘야 하므로 다시 뒤집는다.
          .order("created_at", { ascending: false })
          .limit(100)
      : Promise.resolve({ data: null }),
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

  return (
    <MessengerWidget
      channels={channels}
      activeChannelId={allChannelId ?? channels[0]?.id ?? null}
      initialMessages={(messages ?? []).slice().reverse()}
      profileNames={profileNames}
      currentUserId={currentUserId}
      isAdmin={isAdmin}
    />
  );
}
