"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/components/form-message";

// FeatureToggle(설정 > 기능 관리와 같은 컴포넌트)을 그대로 재사용한다 —
// 그 컴포넌트는 "feature_key 문자열 하나 + 켤지 끌지"만 다루므로, 여기서는
// "page_key::department_id" 합성 키로 어느 칸을 토글했는지 구분한다.
export async function toggleDepartmentPageAccess(_prevState: FormState, formData: FormData): Promise<FormState> {
  const compositeKey = String(formData.get("feature_key") ?? "");
  const enabled = formData.get("enabled") === "1";
  const [pageKey, departmentId] = compositeKey.split("::");
  if (!pageKey || !departmentId) return { error: "잘못된 요청입니다." };

  const supabase = await createClient();

  if (enabled) {
    // 이미 켜둔 칸을 중복 저장하려는 경쟁 상태를 대비해 upsert(중복이면
    // 무시)로 멱등하게 처리한다.
    const { error } = await supabase
      .from("department_page_access")
      .upsert({ page_key: pageKey, department_id: departmentId }, { onConflict: "tenant_id,page_key,department_id", ignoreDuplicates: true });
    if (error) return { error: `저장에 실패했습니다: ${error.message}` };
  } else {
    const { error } = await supabase
      .from("department_page_access")
      .delete()
      .eq("page_key", pageKey)
      .eq("department_id", departmentId);
    if (error) return { error: `저장에 실패했습니다: ${error.message}` };
  }

  // 메뉴 노출(disabledFeatures로 합쳐 넘기는 값)은 layout.tsx가 매 요청마다
  // 다시 계산하므로, 레이아웃을 포함해 무효화해야 트리메뉴가 바로
  // 갱신된다.
  revalidatePath("/", "layout");
  return { success: enabled ? "접근을 허용했습니다." : "접근을 해제했습니다." };
}
