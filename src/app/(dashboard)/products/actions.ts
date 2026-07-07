"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/components/form-message";

function productFieldsFrom(formData: FormData) {
  return {
    category_id: String(formData.get("category_id") ?? "") || null,
    supplier_id: String(formData.get("supplier_id") ?? "") || null,
    spec: String(formData.get("spec") ?? "").trim() || null,
    unit: String(formData.get("unit") ?? "ea") || "ea",
    price: Number(formData.get("price") ?? 0),
    cost: Number(formData.get("cost") ?? 0),
    reorder_point: Number(formData.get("reorder_point") ?? 0),
  };
}

export async function createProduct(_prevState: FormState, formData: FormData): Promise<FormState> {
  const sku = String(formData.get("sku") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!sku || !name) {
    return { error: "SKU와 상품명을 입력해주세요." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("products").insert({
    sku,
    name,
    ...productFieldsFrom(formData),
  });

  if (error) {
    return { error: error.message.includes("duplicate") ? "이미 존재하는 SKU입니다." : "저장에 실패했습니다." };
  }

  revalidatePath("/products");
  return { success: "상품이 등록되었습니다." };
}

export async function updateProduct(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  const sku = String(formData.get("sku") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !sku || !name) {
    return { error: "SKU와 상품명을 입력해주세요." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({ sku, name, ...productFieldsFrom(formData) })
    .eq("id", id);

  if (error) {
    return { error: error.message.includes("duplicate") ? "이미 존재하는 SKU입니다." : "저장에 실패했습니다." };
  }

  revalidatePath("/products");
  revalidatePath(`/products/${id}`);
  return { success: "상품 정보가 저장되었습니다." };
}

export async function deleteProduct(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) {
    return { error: "잘못된 요청입니다." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("products").delete().eq("id", id);

  if (error) {
    return {
      error: error.message.includes("foreign key")
        ? "이 상품과 연결된 매입/매출 내역이 있어 삭제할 수 없습니다."
        : "삭제에 실패했습니다.",
    };
  }

  revalidatePath("/products");
  redirect("/products");
}
