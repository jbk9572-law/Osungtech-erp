"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/components/form-message";
import { requireAdmin } from "@/lib/require-admin";

// 결재양식 하나당 결재선(preset)을 최대 1개만 연결한다 — 마이그레이션
// 112의 template_id unique 제약과 짝이 맞는다. preset_id가 빈 문자열이면
// 연결을 해제(행 삭제)한다.
export async function setApprovalMatrixRule(_prevState: FormState, formData: FormData): Promise<FormState> {
  const { supabase, isAdmin } = await requireAdmin();
  if (!isAdmin) return { error: "관리자만 결재매트릭스를 관리할 수 있습니다." };

  const templateId = String(formData.get("template_id") ?? "");
  const presetId = String(formData.get("preset_id") ?? "");
  if (!templateId) return { error: "잘못된 요청입니다." };

  if (!presetId) {
    const { error } = await supabase.from("approval_matrix_rules").delete().eq("template_id", templateId);
    if (error) return { error: `저장에 실패했습니다: ${error.message}` };
    revalidatePath("/approvals/matrix");
    return { success: "연결을 해제했습니다." };
  }

  const { error } = await supabase
    .from("approval_matrix_rules")
    .upsert({ template_id: templateId, preset_id: presetId }, { onConflict: "template_id" });
  if (error) return { error: `저장에 실패했습니다: ${error.message}` };

  revalidatePath("/approvals/matrix");
  return { success: "저장되었습니다." };
}
