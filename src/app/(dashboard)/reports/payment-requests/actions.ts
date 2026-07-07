"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/components/form-message";

export async function createPaymentRequest(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  const amountRaw = String(formData.get("amount") ?? "").trim();

  if (!title) {
    return { error: "제목을 입력해주세요." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("payment_requests")
    .insert({
      title,
      content,
      amount: amountRaw ? Number(amountRaw) : null,
      requested_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: "등록에 실패했습니다." };
  }

  revalidatePath("/reports/payment-requests");
  redirect(`/reports/payment-requests/${data.id}`);
}

export async function deletePaymentRequest(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) {
    return { error: "잘못된 요청입니다." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("payment_requests").delete().eq("id", id);

  if (error) {
    return { error: "삭제에 실패했습니다." };
  }

  revalidatePath("/reports/payment-requests");
  redirect("/reports/payment-requests");
}
