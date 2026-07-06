"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/components/form-message";

export async function createWarehouse(_prevState: FormState, formData: FormData): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return { error: "창고명을 입력해주세요." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("warehouses").insert({
    name,
    location: String(formData.get("location") ?? "") || null,
  });

  if (error) {
    return { error: error.message.includes("duplicate") ? "이미 존재하는 창고명입니다." : "저장에 실패했습니다." };
  }

  revalidatePath("/warehouses");
  return { success: "창고가 등록되었습니다." };
}
