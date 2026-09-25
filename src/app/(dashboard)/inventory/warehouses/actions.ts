"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/components/form-message";
import { requireMutatedRow } from "@/lib/require-mutated-row";

export async function createWarehouse(_prevState: FormState, formData: FormData): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim() || null;

  if (!name) return { error: "창고명을 입력해주세요." };

  const supabase = await createClient();
  const { error } = await supabase.from("warehouses").insert({ name, location });

  if (error) {
    if (error.code === "23505") return { error: "이미 같은 이름의 창고가 있습니다." };
    return { error: `저장에 실패했습니다: ${error.message}` };
  }

  revalidatePath("/inventory/warehouses");
  revalidatePath("/inventory/transfers/new");
  return { success: "창고를 추가했습니다." };
}

export async function deleteWarehouse(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "잘못된 요청입니다." };

  const supabase = await createClient();
  const result = await supabase.from("warehouses").delete().eq("id", id).select("id");
  const mutationError = requireMutatedRow(result, {
    onError: "삭제에 실패했습니다. 이미 재고/전표에서 쓰이고 있는 창고는 삭제할 수 없습니다",
    onForbidden: "삭제할 수 없습니다.",
  });
  if (mutationError) return mutationError;

  revalidatePath("/inventory/warehouses");
  revalidatePath("/inventory/transfers/new");
  return { success: "삭제했습니다." };
}
