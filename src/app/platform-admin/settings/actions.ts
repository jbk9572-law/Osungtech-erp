"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/require-platform-admin";
import type { FormState } from "@/components/form-message";

// set_platform_default_feature_enabled() RPC(migration 129)로 배열을
// 원자적으로 갱신한다 — 설정/기능관리의 setTenantFeatureEnabled와
// 동일한 패턴, 대상만 tenants가 아니라 platform_settings.
export async function setPlatformDefaultFeatureEnabled(_prevState: FormState, formData: FormData): Promise<FormState> {
  const { supabase, isPlatformAdmin } = await requirePlatformAdmin();
  if (!isPlatformAdmin) return { error: "플랫폼 운영자만 변경할 수 있습니다." };

  const featureKey = String(formData.get("feature_key") ?? "");
  const enabled = formData.get("enabled") === "1";
  if (!featureKey) return { error: "잘못된 요청입니다." };

  const { error } = await supabase.rpc("set_platform_default_feature_enabled", {
    p_feature_key: featureKey,
    p_enabled: enabled,
  });
  if (error) return { error: `저장에 실패했습니다: ${error.message}` };

  revalidatePath("/platform-admin/settings");
  return { success: enabled ? "기본값을 켰습니다." : "기본값을 껐습니다." };
}

const PLANS = ["trial", "active", "suspended"] as const;
type Plan = (typeof PLANS)[number];

// 신규 테넌트 생성 시 적용할 기본 요금제 상태. handle_new_user()
// 트리거(migration 129)가 이 값을 읽어 새 테넌트의 tenants.plan에
// 그대로 써넣는다.
export async function updatePlatformDefaultPlan(_prevState: FormState, formData: FormData): Promise<FormState> {
  const { supabase, isPlatformAdmin } = await requirePlatformAdmin();
  if (!isPlatformAdmin) return { error: "플랫폼 운영자만 변경할 수 있습니다." };

  const plan = String(formData.get("plan") ?? "");
  if (!PLANS.includes(plan as Plan)) return { error: "잘못된 요청입니다." };

  const { error } = await supabase
    .from("platform_settings")
    .update({ default_plan: plan, updated_at: new Date().toISOString() })
    .eq("id", true);
  if (error) return { error: `저장에 실패했습니다: ${error.message}` };

  revalidatePath("/platform-admin/settings");
  return { success: "기본 요금제를 저장했습니다." };
}

// 점검 모드 — 켜두면 (dashboard)/layout.tsx가 플랫폼 운영자를 제외한
// 모든 사용자에게 안내 화면만 보여주고 실제 업무 화면은 막는다(대규모
// 마이그레이션/배포 작업 중 사용). 플랫폼 운영자 본인은 이 값과 무관하게
// 항상 접근할 수 있어야 꺼야 하는 사람이 자기가 걸어놓은 점검 모드에
// 자기도 막히는 일이 없다.
export async function setMaintenanceMode(_prevState: FormState, formData: FormData): Promise<FormState> {
  const { supabase, isPlatformAdmin } = await requirePlatformAdmin();
  if (!isPlatformAdmin) return { error: "플랫폼 운영자만 변경할 수 있습니다." };

  const enabled = formData.get("enabled") === "1";
  const message = String(formData.get("message") ?? "").trim() || null;

  const { error } = await supabase
    .from("platform_settings")
    .update({ maintenance_mode: enabled, maintenance_message: message, updated_at: new Date().toISOString() })
    .eq("id", true);
  if (error) return { error: `저장에 실패했습니다: ${error.message}` };

  revalidatePath("/platform-admin/settings");
  return { success: enabled ? "점검 모드를 켰습니다." : "점검 모드를 껐습니다." };
}
