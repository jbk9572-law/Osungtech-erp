"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/components/form-message";
import { requireMutatedRow } from "@/lib/require-mutated-row";

export async function createApprovalLinePreset(_prevState: FormState, formData: FormData): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  const approverIds = formData.getAll("approver_id").map(String).filter(Boolean);
  const referenceIds = formData.getAll("reference_id").map(String).filter(Boolean);

  if (!name) return { error: "결재선 이름을 입력해주세요." };
  if (approverIds.length === 0) return { error: "결재자를 1명 이상 지정해주세요." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("approval_line_presets")
    .insert({ name, approver_ids: approverIds, reference_ids: referenceIds });

  if (error) return { error: `저장에 실패했습니다: ${error.message}` };

  revalidatePath("/approvals/lines");
  redirect("/approvals/lines");
}

export async function updateApprovalLinePreset(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const approverIds = formData.getAll("approver_id").map(String).filter(Boolean);
  const referenceIds = formData.getAll("reference_id").map(String).filter(Boolean);

  if (!id) return { error: "잘못된 요청입니다." };
  if (!name) return { error: "결재선 이름을 입력해주세요." };
  if (approverIds.length === 0) return { error: "결재자를 1명 이상 지정해주세요." };

  const supabase = await createClient();
  const result = await supabase
    .from("approval_line_presets")
    .update({ name, approver_ids: approverIds, reference_ids: referenceIds })
    .eq("id", id)
    .select("id");
  const mutationError = requireMutatedRow(result, {
    onError: "저장에 실패했습니다",
    onForbidden: "본인이 만든 결재선 또는 관리자만 수정할 수 있습니다.",
  });
  if (mutationError) return mutationError;

  revalidatePath("/approvals/lines");
  redirect("/approvals/lines");
}

export async function deleteApprovalLinePreset(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "잘못된 요청입니다." };

  const supabase = await createClient();
  const result = await supabase.from("approval_line_presets").delete().eq("id", id).select("id");
  const mutationError = requireMutatedRow(result, {
    onError: "삭제에 실패했습니다",
    onForbidden: "본인이 만든 결재선 또는 관리자만 삭제할 수 있습니다.",
  });
  if (mutationError) return mutationError;

  revalidatePath("/approvals/lines");
  return { success: "삭제했습니다." };
}
