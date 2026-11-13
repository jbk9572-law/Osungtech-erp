"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUser } from "@/lib/supabase/server";
import { getCurrentActor } from "@/lib/current-actor";
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

// 회사 기본 배치 — 관리자만 저장/해제한다(DB 정책도 같은 규칙으로 막는다). 개인 배치를 저장하지 않은 모든 직원에게
// 기본으로 보인다. 이미 개인 배치를 저장한 사람의 화면은 바뀌지 않는다.
export async function saveTenantDefaultLayout(raw: unknown): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { userId, isAdmin } = await getCurrentActor(supabase);
  if (!userId) return { ok: false, error: "로그인이 필요합니다." };
  if (!isAdmin) return { ok: false, error: "관리자만 회사 기본 배치를 저장할 수 있습니다." };

  const { error } = await supabase
    .from("tenant_dashboard_layout")
    .upsert({ layout: normalizeDashboardLayout(raw), updated_by: userId, updated_at: new Date().toISOString() }, { onConflict: "tenant_id" });
  if (error) {
    console.error("회사 기본 배치 저장 실패:", error);
    return { ok: false, error: "회사 기본 배치를 저장하지 못했습니다. 잠시 후 다시 시도해주세요." };
  }
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function clearTenantDefaultLayout(): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { userId, isAdmin } = await getCurrentActor(supabase);
  if (!userId) return { ok: false, error: "로그인이 필요합니다." };
  if (!isAdmin) return { ok: false, error: "관리자만 회사 기본 배치를 해제할 수 있습니다." };

  // tenant_id를 직접 지정하지 않아도 RLS(같은 회사 + 관리자)가 이 회사 한 행만 대상으로 만든다.
  const { error } = await supabase.from("tenant_dashboard_layout").delete().not("tenant_id", "is", null);
  if (error) {
    console.error("회사 기본 배치 해제 실패:", error);
    return { ok: false, error: "회사 기본 배치를 해제하지 못했습니다. 잠시 후 다시 시도해주세요." };
  }
  revalidatePath("/dashboard");
  return { ok: true };
}
