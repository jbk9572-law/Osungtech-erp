"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUser } from "@/lib/supabase/server";
import { normalizeDashboardLayout, type DashboardLayout } from "@/lib/dashboard-layout";

// 메인 대시보드 위젯 배치 저장/초기화 — 계정별(user_id) 한 행. 받은 값은 신뢰하지 않고 서버에서
// 다시 검증·보정한 뒤 저장한다(모르는 위젯·범위 밖 숫자 제거).
export async function saveDashboardLayout(raw: unknown): Promise<{ ok: boolean; error?: string }> {
  const user = await getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };

  const layout: DashboardLayout = normalizeDashboardLayout(raw);
  const supabase = await createClient();
  const { error } = await supabase
    .from("ui_dashboard_layout")
    .upsert({ user_id: user.id, layout, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) {
    console.error("대시보드 배치 저장 실패:", error);
    return { ok: false, error: "저장하지 못했습니다. 잠시 후 다시 시도해주세요." };
  }
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function resetDashboardLayout(): Promise<{ ok: boolean; error?: string }> {
  const user = await getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };

  const supabase = await createClient();
  const { error } = await supabase.from("ui_dashboard_layout").delete().eq("user_id", user.id);
  if (error) {
    console.error("대시보드 배치 초기화 실패:", error);
    return { ok: false, error: "기본값으로 되돌리지 못했습니다. 잠시 후 다시 시도해주세요." };
  }
  revalidatePath("/dashboard");
  return { ok: true };
}
