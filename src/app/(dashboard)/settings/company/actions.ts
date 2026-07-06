"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/components/form-message";

export async function updateCompanyProfile(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return { error: "상호명을 입력해주세요." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("company_profile")
    .update({
      name,
      business_number: String(formData.get("business_number") ?? "") || null,
      representative_name: String(formData.get("representative_name") ?? "") || null,
      address: String(formData.get("address") ?? "") || null,
      business_type: String(formData.get("business_type") ?? "") || null,
      business_item: String(formData.get("business_item") ?? "") || null,
      phone: String(formData.get("phone") ?? "") || null,
      fax_number: String(formData.get("fax_number") ?? "") || null,
      manager_name: String(formData.get("manager_name") ?? "") || null,
      manager_phone: String(formData.get("manager_phone") ?? "") || null,
    })
    .eq("id", 1);

  if (error) {
    return { error: "저장에 실패했습니다." };
  }

  revalidatePath("/settings/company");
  return { success: "회사 정보가 저장되었습니다." };
}
