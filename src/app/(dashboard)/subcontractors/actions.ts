"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/components/form-message";
import { requireMutatedRow } from "@/lib/require-mutated-row";
import { combinePhone } from "@/lib/phone";

function subcontractorFieldsFrom(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim(),
    contact_name: String(formData.get("contact_name") ?? "") || null,
    phone: combinePhone(formData),
    memo: String(formData.get("memo") ?? "") || null,
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
