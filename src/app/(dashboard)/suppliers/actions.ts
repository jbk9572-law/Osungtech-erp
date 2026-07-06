"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { combinePhone } from "@/lib/phone";
import type { FormState } from "@/components/form-message";

function supplierFieldsFrom(formData: FormData) {
  return {
    business_number: String(formData.get("business_number") ?? "") || null,
    representative_name: String(formData.get("representative_name") ?? "") || null,
    contact_name: String(formData.get("contact_name") ?? "") || null,
    email: String(formData.get("email") ?? "") || null,
    phone: combinePhone(formData),
    address: String(formData.get("address") ?? "") || null,
    notes: String(formData.get("notes") ?? "") || null,
  };
}

export async function createSupplier(_prevState: FormState, formData: FormData): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return { error: "업체명을 입력해주세요." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("suppliers").insert({
    name,
    ...supplierFieldsFrom(formData),
  });

  if (error) {
    return { error: "저장에 실패했습니다." };
  }

  revalidatePath("/suppliers");
  return { success: "공급업체가 등록되었습니다." };
}

export async function updateSupplier(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) {
    return { error: "업체명을 입력해주세요." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("suppliers")
    .update({ name, ...supplierFieldsFrom(formData) })
    .eq("id", id);

  if (error) {
    return { error: "저장에 실패했습니다." };
  }

  revalidatePath("/suppliers");
  revalidatePath(`/suppliers/${id}`);
  return { success: "공급업체 정보가 저장되었습니다." };
}

export async function deleteSupplier(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) {
    return { error: "잘못된 요청입니다." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("suppliers").delete().eq("id", id);

  if (error) {
    return {
      error: error.message.includes("foreign key")
        ? "이 공급업체와 연결된 매입/상품 내역이 있어 삭제할 수 없습니다."
        : "삭제에 실패했습니다.",
    };
  }

  revalidatePath("/suppliers");
  redirect("/suppliers");
}
