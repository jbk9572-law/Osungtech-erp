"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMutatedRow } from "@/lib/require-mutated-row";
import type { FormState } from "@/components/form-message";

const ACTIVITY_TYPES = ["전화", "방문", "이메일", "기타"] as const;
type ActivityType = (typeof ACTIVITY_TYPES)[number];

export async function createActivity(_prevState: FormState, formData: FormData): Promise<FormState> {
  const customerId = String(formData.get("customer_id") ?? "").trim();
  const activityTypeRaw = String(formData.get("activity_type") ?? "기타");
  const activityType: ActivityType = ACTIVITY_TYPES.includes(activityTypeRaw as ActivityType)
    ? (activityTypeRaw as ActivityType)
    : "기타";
  const subject = String(formData.get("subject") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  const activityDate = String(formData.get("activity_date") ?? "").trim();
  const nextActionDate = String(formData.get("next_action_date") ?? "").trim();
  const nextActionMemo = String(formData.get("next_action_memo") ?? "").trim();

  if (!customerId) return { error: "거래처를 선택해주세요." };
  if (!subject) return { error: "제목을 입력해주세요." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("sales_activities").insert({
    customer_id: customerId,
    activity_type: activityType,
    subject,
    content: content || null,
    activity_date: activityDate || undefined,
    next_action_date: nextActionDate || null,
    next_action_memo: nextActionMemo || null,
    created_by: user?.id ?? null,
  });

  if (error) {
    return { error: `등록에 실패했습니다: ${error.message}` };
  }

  revalidatePath("/sales-activities");
  revalidatePath(`/customers/${customerId}`);
  return { success: "활동이 기록되었습니다." };
}

export async function toggleActivityNextActionDone(formData: FormData): Promise<{ error: string } | undefined> {
  const id = String(formData.get("id") ?? "");
  const done = formData.get("done") === "true";
  if (!id) return { error: "잘못된 요청입니다." };

  const supabase = await createClient();
  const result = await supabase.from("sales_activities").update({ next_action_done: done }).eq("id", id).select("id");

  const updateError = requireMutatedRow(result, "처리에 실패했습니다");
  if (updateError) return updateError;

  revalidatePath("/sales-activities");
}

export async function deleteActivity(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "잘못된 요청입니다." };

  const supabase = await createClient();
  const result = await supabase.from("sales_activities").delete().eq("id", id).select("id");

  const deleteError = requireMutatedRow(result, "삭제에 실패했습니다");
  if (deleteError) return deleteError;

  revalidatePath("/sales-activities");
  return { success: "삭제되었습니다." };
}
