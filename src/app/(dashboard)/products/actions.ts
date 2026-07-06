"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/components/form-message";

export async function createProduct(_prevState: FormState, formData: FormData): Promise<FormState> {
  const sku = String(formData.get("sku") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!sku || !name) {
    return { error: "SKU와 상품명을 입력해주세요." };
  }

  const categoryId = String(formData.get("category_id") ?? "") || null;
  const supplierId = String(formData.get("supplier_id") ?? "") || null;

  const supabase = await createClient();
  const { error } = await supabase.from("products").insert({
    sku,
    name,
    category_id: categoryId,
    supplier_id: supplierId,
    unit: String(formData.get("unit") ?? "ea") || "ea",
    price: Number(formData.get("price") ?? 0),
    cost: Number(formData.get("cost") ?? 0),
    reorder_point: Number(formData.get("reorder_point") ?? 0),
  });

  if (error) {
    return { error: error.message.includes("duplicate") ? "이미 존재하는 SKU입니다." : "저장에 실패했습니다." };
  }

  revalidatePath("/products");
  return { success: "상품이 등록되었습니다." };
}
