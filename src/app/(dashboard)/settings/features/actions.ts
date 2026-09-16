"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/components/form-message";

// set_tenant_feature_enabled() RPC(migration 104)로 배열을 원자적으로
// 갱신한다 — 관리자 여부/소속 테넌트 검증은 RPC 안에서 한다.
export async function setTenantFeatureEnabled(_prevState: FormState, formData: FormData): Promise<FormState> {
  const featureKey = String(formData.get("feature_key") ?? "");
  const enabled = formData.get("enabled") === "1";
  if (!featureKey) return { error: "잘못된 요청입니다." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_tenant_feature_enabled", {
    p_feature_key: featureKey,
    p_enabled: enabled,
  });

  if (error) {
    return { error: `저장에 실패했습니다: ${error.message}` };
  }

  // 메뉴 표시는 layout.tsx가 매 요청마다 다시 계산하므로, 레이아웃을
  // 포함해 무효화해야 트리메뉴/타이틀바가 바로 갱신된다(settings/company의
  // 로고 갱신과 같은 이유).
  revalidatePath("/", "layout");
  return { success: enabled ? "기능을 켰습니다." : "기능을 껐습니다." };
}
