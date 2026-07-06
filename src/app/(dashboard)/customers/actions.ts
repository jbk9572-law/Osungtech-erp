"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/components/form-message";

export async function createCustomer(_prevState: FormState, formData: FormData): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return { error: "거래처명을 입력해주세요." };
  }

  const documentType = String(formData.get("document_type") ?? "명세표");

  const supabase = await createClient();
  const { error } = await supabase.from("customers").insert({
    name,
    business_number: String(formData.get("business_number") ?? "") || null,
    representative_name: String(formData.get("representative_name") ?? "") || null,
    contact_name: String(formData.get("contact_name") ?? "") || null,
    email: String(formData.get("email") ?? "") || null,
    phone: String(formData.get("phone") ?? "") || null,
    address: String(formData.get("address") ?? "") || null,
    document_type: documentType === "출고증" ? "출고증" : "명세표",
  });

  if (error) {
    return { error: "저장에 실패했습니다." };
  }

  revalidatePath("/customers");
  return { success: "거래처가 등록되었습니다." };
}

export async function updateCustomerDocumentType(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const customerId = String(formData.get("customer_id") ?? "");
  const documentType = String(formData.get("document_type") ?? "");
  if (!customerId || (documentType !== "출고증" && documentType !== "명세표")) {
    return { error: "잘못된 요청입니다." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .update({ document_type: documentType })
    .eq("id", customerId);

  if (error) {
    return { error: "저장에 실패했습니다." };
  }

  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/customers");
  return { success: "발행 문서 설정이 저장되었습니다." };
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
