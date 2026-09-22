"use server";

import { createClient } from "@/lib/supabase/server";

// 브라우저 알림 종에서 "브라우저 알림 켜기"를 누르면 pushManager.subscribe()
// 로 받은 구독 정보(endpoint/키 두 개)를 저장한다. endpoint가 unique라
// 같은 브라우저에서 다시 켜도(구독이 만료돼 새로 받은 경우 포함) 그대로
// upsert된다.
export async function subscribePush(endpoint: string, p256dh: string, auth: string): Promise<{ error?: string }> {
  if (!endpoint || !p256dh || !auth) return { error: "잘못된 구독 정보입니다." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const { error } = await supabase
    .from("push_subscriptions")
    .upsert({ user_id: user.id, endpoint, p256dh, auth }, { onConflict: "endpoint" });
  if (error) return { error: `알림 등록에 실패했습니다: ${error.message}` };
  return {};
}

export async function unsubscribePush(endpoint: string): Promise<{ error?: string }> {
  if (!endpoint) return { error: "잘못된 요청입니다." };

  const supabase = await createClient();
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  if (error) return { error: `알림 해지에 실패했습니다: ${error.message}` };
  return {};
}
