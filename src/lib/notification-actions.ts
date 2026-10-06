"use server";

import { createClient, getUser } from "@/lib/supabase/server";

// notification_events는 RLS로 본인 행(user_id = auth.uid())만 select/update
// 가능하게 열려 있어서(migration 159), service role 없이 요청자 클라이언트
// 그대로 써도 된다 — insert는 notify()/notifyForTenant()만 쓰는 service
// role 전용이라 여기서는 update만 다룬다.
export async function markNotificationRead(id: string): Promise<{ error?: string }> {
  const user = await getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("notification_events")
    .update({ is_read: true })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { error: error.message };
  return {};
}
