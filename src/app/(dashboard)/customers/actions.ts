"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { combinePhone } from "@/lib/phone";
import type { FormState } from "@/components/form-message";

const DELIVERY_NOTE_VARIANTS = ["sns_filtech", "zenith_tech", "ket_solution"] as const;

function customerFieldsFrom(formData: FormData) {
  const documentType = String(formData.get("document_type") ?? "명세표");
  const variant = String(formData.get("delivery_note_variant") ?? "");
  return {
    business_number: String(formData.get("business_number") ?? "") || null,
    representative_name: String(formData.get("representative_name") ?? "") || null,
    contact_name: String(formData.get("contact_name") ?? "") || null,
    email: String(formData.get("email") ?? "") || null,
    phone: combinePhone(formData),
    address: String(formData.get("address") ?? "") || null,
    notes: String(formData.get("notes") ?? "") || null,
    document_type: (documentType === "출고증" ? "출고증" : "명세표") as "출고증" | "명세표",
    delivery_note_variant: (DELIVERY_NOTE_VARIANTS as readonly string[]).includes(variant)
      ? (variant as (typeof DELIVERY_NOTE_VARIANTS)[number])
      : null,
  };
}

export async function createCustomer(_prevState: FormState, formData: FormData): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return { error: "거래처명을 입력해주세요." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("customers").insert({
    name,
    ...customerFieldsFrom(formData),
  });

  if (error) {
    return { error: "저장에 실패했습니다." };
  }

  revalidatePath("/customers");
  return { success: "거래처가 등록되었습니다." };
}

export async function updateCustomer(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) {
    return { error: "거래처명을 입력해주세요." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .update({ name, ...customerFieldsFrom(formData) })
    .eq("id", id);

  if (error) {
    return { error: "저장에 실패했습니다." };
  }

  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  return { success: "거래처 정보가 저장되었습니다." };
}

export async function deleteCustomer(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) {
    return { error: "잘못된 요청입니다." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("customers").delete().eq("id", id);

  if (error) {
    return {
      error: error.message.includes("foreign key")
        ? "이 거래처와 연결된 매출/판매단가 내역이 있어 삭제할 수 없습니다."
        : "삭제에 실패했습니다.",
    };
  }

  revalidatePath("/customers");
  redirect("/customers");
}

export async function upsertCustomerPrice(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const customerId = String(formData.get("customer_id") ?? "");
  const productId = String(formData.get("product_id") ?? "");
  const unitPrice = Number(formData.get("unit_price") ?? 0);
  if (!customerId || !productId) {
    return { error: "상품을 선택해주세요." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("customer_product_prices")
    .upsert(
      { customer_id: customerId, product_id: productId, unit_price: unitPrice },
      { onConflict: "customer_id,product_id" }
    );

  if (error) {
    return { error: "저장에 실패했습니다." };
  }

  revalidatePath(`/customers/${customerId}`);
  return { success: "판매단가가 저장되었습니다." };
}
