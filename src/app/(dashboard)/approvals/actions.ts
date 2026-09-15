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

// 회수 — recall_approval_document() RPC(migration 113)가 "아직 아무도
// 결재하지 않은 pending 문서인지"를 안에서 다시 검증한다(여기서 미리
// 걸러도 그 사이 결재자가 처리했을 수 있으므로 최종 검증은 항상 DB에서).
export async function recallApprovalDocument(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "잘못된 요청입니다." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("recall_approval_document", { p_id: id });
  if (error) {
    return { error: `회수에 실패했습니다: ${error.message}` };
  }

  revalidatePath(`/approvals/${id}`);
  revalidatePath("/approvals");
  return { success: "기안을 회수했습니다." };
}

// 임시저장 — 아직 결재선을 확정하지 않은 채로 제목/내용/담아둔 결재자·
// 참조자 명단만 저장해둔다(approval_steps는 이 시점에 생기지 않는다 —
// save_approval_draft() 주석 참고).
export async function saveApprovalDraft(_prevState: FormState, formData: FormData): Promise<FormState> {
  const draftId = String(formData.get("draft_id") ?? "").trim() || null;
  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  const approverIds = formData.getAll("approver_id").map(String).filter(Boolean);
  const referenceIds = formData.getAll("reference_id").map(String).filter(Boolean);

  if (!title) {
    return { error: "제목을 입력해주세요." };
  }

  const supabase = await createClient();
  const { data: newId, error } = await supabase.rpc("save_approval_draft", {
    p_id: draftId,
    p_title: title,
    p_content: content,
    p_approver_ids: approverIds,
    p_reference_ids: referenceIds,
  });

  if (error || !newId) {
    return { error: `임시저장에 실패했습니다: ${error?.message ?? "알 수 없는 오류"}` };
  }

  revalidatePath("/approvals/drafts");
  if (!draftId) {
    return { success: "임시저장되었습니다.", redirectTo: `/approvals/new?draft=${newId}` };
  }
  return { success: "임시저장되었습니다." };
}

// 임시저장 문서를 제출한다 — 폼에 남아있는 최신 편집 내용을 먼저
// save_approval_draft()로 반영한 뒤, submit_approval_draft()로 결재선을
// 확정하고 결재를 시작한다.
export async function submitApprovalDraft(_prevState: FormState, formData: FormData): Promise<FormState> {
  const draftId = String(formData.get("draft_id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  const approverIds = formData.getAll("approver_id").map(String).filter(Boolean);
  const referenceIds = formData.getAll("reference_id").map(String).filter(Boolean);

  if (!draftId) {
    return { error: "임시저장 문서를 먼저 저장해주세요." };
  }
  if (!title) {
    return { error: "제목을 입력해주세요." };
  }
  if (approverIds.length === 0) {
    return { error: "결재선(승인자)을 1명 이상 지정해주세요." };
  }

  const supabase = await createClient();
  const { error: saveError } = await supabase.rpc("save_approval_draft", {
    p_id: draftId,
    p_title: title,
    p_content: content,
    p_approver_ids: approverIds,
    p_reference_ids: referenceIds,
  });
  if (saveError) {
    return { error: `저장에 실패했습니다: ${saveError.message}` };
  }

  const { error: submitError } = await supabase.rpc("submit_approval_draft", { p_id: draftId });
  if (submitError) {
    return { error: `기안 등록에 실패했습니다: ${submitError.message}` };
  }

  revalidatePath("/approvals");
  revalidatePath("/approvals/drafts");
  redirect(`/approvals/${draftId}`);
}

// 임시저장 문서 삭제 — 삭제 자체는 기존 approval_documents 삭제 정책
// (created_by 본인 또는 관리자)을 그대로 쓴다. draft는 approval_steps가
// 없으므로 cascade로 지울 것도 없다.
export async function deleteApprovalDraft(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "잘못된 요청입니다." };

  const supabase = await createClient();
  const result = await supabase.from("approval_documents").delete().eq("id", id).eq("status", "draft").select("id");
  const mutationError = requireMutatedRow(result, {
    onError: "삭제에 실패했습니다",
    onForbidden: "본인이 작성한 임시저장 문서만 삭제할 수 있습니다.",
  });
  if (mutationError) return mutationError;

  revalidatePath("/approvals/drafts");
  return { success: "삭제했습니다." };
}
