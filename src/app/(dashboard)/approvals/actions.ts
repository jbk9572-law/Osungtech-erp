"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/components/form-message";
import { requireMutatedRow } from "@/lib/require-mutated-row";

// 기안서 등록 — submit_approval_document() RPC(migration 102) 하나로
// 문서+결재선을 원자적으로 만든다. 매출/매입 등록 RPC와 같은 이유(중간에
// 실패해도 결재선 없는 반쪽 문서가 안 남게).
export async function submitApprovalDocument(_prevState: FormState, formData: FormData): Promise<FormState> {
  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  const approverIds = formData.getAll("approver_id").map(String).filter(Boolean);
  const referenceIds = formData.getAll("reference_id").map(String).filter(Boolean);

  if (!title) {
    return { error: "제목을 입력해주세요." };
  }
  if (approverIds.length === 0) {
    return { error: "결재선(승인자)을 1명 이상 지정해주세요." };
  }

  const supabase = await createClient();
  const { data: docId, error } = await supabase.rpc("submit_approval_document", {
    p_title: title,
    p_content: content,
    p_approver_ids: approverIds,
    p_reference_ids: referenceIds,
  });

  if (error || !docId) {
    return { error: `기안 등록에 실패했습니다: ${error?.message ?? "알 수 없는 오류"}` };
  }

  revalidatePath("/approvals");
  redirect(`/approvals/${docId}`);
}

export async function decideApprovalStep(_prevState: FormState, formData: FormData): Promise<FormState> {
  const stepId = String(formData.get("step_id") ?? "");
  const documentId = String(formData.get("document_id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const comment = String(formData.get("comment") ?? "").trim() || null;

  if (!stepId || (decision !== "approved" && decision !== "rejected")) {
    return { error: "잘못된 요청입니다." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("decide_approval_step", {
    p_step_id: stepId,
    p_decision: decision,
    p_comment: comment,
  });

  if (error) {
    return { error: `처리에 실패했습니다: ${error.message}` };
  }

  if (documentId) revalidatePath(`/approvals/${documentId}`);
  revalidatePath("/approvals");
  return { success: decision === "approved" ? "승인했습니다." : "반려했습니다." };
}

export async function deleteApprovalDocument(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "잘못된 요청입니다." };

  const supabase = await createClient();
  const result = await supabase.from("approval_documents").delete().eq("id", id).select("id");
  const mutationError = requireMutatedRow(result, {
    onError: "삭제에 실패했습니다",
    onForbidden: "본인이 기안한 문서만 삭제할 수 있습니다.",
  });
  if (mutationError) return mutationError;

  revalidatePath("/approvals");
  redirect("/approvals");
}
