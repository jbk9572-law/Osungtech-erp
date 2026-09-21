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
