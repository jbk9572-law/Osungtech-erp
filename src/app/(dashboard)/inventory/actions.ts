"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/components/form-message";

export async function adjustInventory(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const productId = String(formData.get("product_id") ?? "");
  const warehouseId = String(formData.get("warehouse_id") ?? "");
  const quantity = Number(formData.get("quantity") ?? 0);
  const note = String(formData.get("note") ?? "") || null;

  if (!productId || !warehouseId) {
    return { error: "상품과 창고를 선택해주세요." };
  }
  if (!quantity) {
    return { error: "0이 아닌 수량을 입력해주세요. (기초재고 등록은 양수, 재고 차감은 음수)" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("inventory_transactions").insert({
    product_id: productId,
    warehouse_id: warehouseId,
    type: "adjustment",
    quantity,
    note,
    created_by: user?.id ?? null,
  });

  if (error) {
    return { error: "재고 조정에 실패했습니다." };
  }

  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  return { success: "재고가 조정되었습니다." };
}
