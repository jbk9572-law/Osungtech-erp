"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentActor } from "@/lib/current-actor";
import type { FormState } from "@/components/form-message";
import { requireMutatedRow } from "@/lib/require-mutated-row";

// 순환 위임 방지는 DB 트리거(check_approval_delegation_chain, 마이그레이션
// 111)가 최종적으로 막아준다 — 여기서는 사람이 읽기 편한 기본 검증만 한다.
export async function createApprovalDelegation(_prevState: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient();
  const { userId, isAdmin } = await getCurrentActor(supabase);
  if (!userId) return { error: "인증되지 않은 요청입니다." };

  const delegatorId = isAdmin ? String(formData.get("delegator_id") ?? "") || userId : userId;
  const delegateId = String(formData.get("delegate_id") ?? "");
  const startDate = String(formData.get("start_date") ?? "");
  const endDate = String(formData.get("end_date") ?? "");
  const reason = String(formData.get("reason") ?? "").trim() || null;

  if (!delegateId) return { error: "대리 결재자를 지정해주세요." };
  if (delegatorId === delegateId) return { error: "본인을 대리 결재자로 지정할 수 없습니다." };
  if (!startDate || !endDate) return { error: "위임 기간(시작일/종료일)을 입력해주세요." };
  if (endDate < startDate) return { error: "종료일이 시작일보다 빠를 수 없습니다." };

  const { error } = await supabase.from("approval_delegations").insert({
    delegator_id: delegatorId,
    delegate_id: delegateId,
    start_date: startDate,
    end_date: endDate,
    reason,
    created_by: userId,
  });

  if (error) {
    return { error: `저장에 실패했습니다: ${error.message}` };
  }

  revalidatePath("/settings/delegations");
  return { success: "결재권을 위임했습니다." };
}

export async function deleteApprovalDelegation(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "잘못된 요청입니다." };

  const supabase = await createClient();
  const result = await supabase.from("approval_delegations").delete().eq("id", id).select("id");
  const mutationError = requireMutatedRow(result, {
    onError: "삭제에 실패했습니다",
    onForbidden: "위임자 본인 또는 관리자만 삭제할 수 있습니다.",
  });
  if (mutationError) return mutationError;

  revalidatePath("/settings/delegations");
  return { success: "위임을 삭제했습니다." };
}
