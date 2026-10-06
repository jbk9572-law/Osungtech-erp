"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUser } from "@/lib/supabase/server";
import type { FormState } from "@/components/form-message";
import { requireMutatedRow } from "@/lib/require-mutated-row";
import { combinePhone } from "@/lib/phone";

function subcontractorFieldsFrom(formData: FormData) {
  const defaultUnitCostRaw = String(formData.get("default_unit_cost") ?? "").trim();
  return {
    name: String(formData.get("name") ?? "").trim(),
    contact_name: String(formData.get("contact_name") ?? "") || null,
    phone: combinePhone(formData),
    memo: String(formData.get("memo") ?? "") || null,
    default_unit_cost: defaultUnitCostRaw ? Number(defaultUnitCostRaw) : null,
  };
}

export async function createSubcontractor(_prevState: FormState, formData: FormData): Promise<FormState> {
  const fields = subcontractorFieldsFrom(formData);
  if (!fields.name) return { error: "업체명을 입력해주세요." };

  const supabase = await createClient();
  const { error } = await supabase.from("subcontractors").insert(fields);
  if (error) return { error: `등록에 실패했습니다: ${error.message}` };

  revalidatePath("/subcontractors");
  return { success: "업체를 등록했습니다." };
}

export async function updateSubcontractor(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  const fields = subcontractorFieldsFrom(formData);
  if (!id) return { error: "잘못된 요청입니다." };
  if (!fields.name) return { error: "업체명을 입력해주세요." };

  const supabase = await createClient();
  const result = await supabase.from("subcontractors").update(fields).eq("id", id).select("id");
  const mutationError = requireMutatedRow(result, "업체를 찾을 수 없습니다.");
  if (mutationError) return mutationError;

  revalidatePath("/subcontractors");
  return { success: "저장했습니다." };
}

export async function deleteSubcontractor(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "잘못된 요청입니다." };

  const supabase = await createClient();
  const { error } = await supabase.from("subcontractors").delete().eq("id", id);
  if (error) return { error: `삭제에 실패했습니다: ${error.message}` };

  revalidatePath("/subcontractors");
  return { success: "업체를 삭제했습니다." };
}

export async function addSubcontractorPayment(_prevState: FormState, formData: FormData): Promise<FormState> {
  const subcontractorId = String(formData.get("subcontractor_id") ?? "");
  const paidAt = String(formData.get("paid_at") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  if (!subcontractorId || !paidAt || !(amount > 0)) {
    return { error: "일자와 금액을 입력해주세요." };
  }

  const supabase = await createClient();
  const user = await getUser();

  const { error } = await supabase.from("subcontractor_payments").insert({
    subcontractor_id: subcontractorId,
    paid_at: paidAt,
    amount,
    method: String(formData.get("method") ?? "") || null,
    memo: String(formData.get("memo") ?? "") || null,
    created_by: user?.id ?? null,
  });

  if (error) {
    return { error: `지급 등록에 실패했습니다: ${error.message}` };
  }

  revalidatePath("/subcontractors");
  revalidatePath("/subcontractor-payables");
  return { success: "지급 내역을 등록했습니다." };
}

export async function deleteSubcontractorPayment(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "잘못된 요청입니다." };

  const supabase = await createClient();
  const result = await supabase.from("subcontractor_payments").delete().eq("id", id).select("id");
  const mutationError = requireMutatedRow(result, {
    onError: "삭제에 실패했습니다",
    onForbidden: "본인이 등록한 지급 내역만 삭제할 수 있습니다.",
  });
  if (mutationError) return mutationError;

  revalidatePath("/subcontractors");
  revalidatePath("/subcontractor-payables");
  return { success: "삭제했습니다." };
}
