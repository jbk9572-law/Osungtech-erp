"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/components/form-message";

export async function createSupplier(_prevState: FormState, formData: FormData): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return { error: "업체명을 입력해주세요." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("suppliers").insert({
    name,
    contact_name: String(formData.get("contact_name") ?? "") || null,
    email: String(formData.get("email") ?? "") || null,
    phone: String(formData.get("phone") ?? "") || null,
  });

  if (error) {
    return { error: "저장에 실패했습니다." };
  }

  revalidatePath("/suppliers");
  return { success: "공급업체가 등록되었습니다." };
}
