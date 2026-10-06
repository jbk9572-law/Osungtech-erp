import { createClient, getUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { safeQuery } from "@/lib/safe-query";
import { isFeatureEnabled } from "@/lib/require-feature-enabled";
import { MessengerPage } from "@/components/erp/messenger-page";
import type { MessengerChannel } from "@/lib/messenger-types";

// 예전엔 우측하단에 항상 떠 있는 팝업 위젯이었는데(모든 화면 전역),
// 이제 그룹웨어 > 메신저로 찾아 들어오는 일반 페이지다 — 다른
// featureKey 붙은 화면들처럼 이 화면도 꺼둘 수 있어야 해서
// requireFeatureEnabled로 가드한다. 메일/알림은 더 이상 이 화면에서
// 안 다룬다(메일함은 독립된 /mail 화면, 알림은 "전체" 대화방에 시스템봇
// 메시지로 흡수됐다 — messenger-page.tsx 주석 참고) — 그래서 이 페이지는
// 대화 채널/메시지만 조회한다.
export default async function MessengerPageRoute() {
  const supabase = await createClient();
  await isFeatureEnabled(supabase, "messenger").then((enabled) => {
    if (!enabled) redirect("/dashboard");
  });

  const user = await getUser();
  if (!user) redirect("/login");

  const { data: profiles } = await safeQuery<{ id: string; full_name: string | null; role: string }[]>(
    supabase.from("profiles").select("id, full_name, role"),
  );

  const profileNames = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.full_name || "구성원"]));
  const isAdmin = (profiles ?? []).find((p) => p.id === user.id)?.role === "admin";

  const { data: allChannelId } = await safeQuery<string>(supabase.rpc("get_or_create_all_channel"));

  const [{ data: channelRows }, { data: memberRows }, { data: messages }] = await Promise.all([
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
    <MessengerPage
      channels={channels}
      activeChannelId={allChannelId ?? channels[0]?.id ?? null}
      initialMessages={(messages ?? []).slice().reverse()}
      profileNames={profileNames}
      currentUserId={user.id}
      isAdmin={isAdmin}
    />
  );
}
