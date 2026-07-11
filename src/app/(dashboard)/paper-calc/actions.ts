"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/components/form-message";

export async function savePaperCalculation(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const salesOrderId = String(formData.get("salesOrderId") ?? "").trim() || null;
  const paperW = Number(formData.get("paperW"));
  const paperH = Number(formData.get("paperH"));
  const inputItemsRaw = String(formData.get("inputItems") ?? "");
  const totalPaper = Number(formData.get("totalPaper"));
  const totalSheet = Number(formData.get("totalSheet"));
  const totalProd = Number(formData.get("totalProd"));
  const overProd = Number(formData.get("overProd"));
  const fulfilled = formData.get("fulfilled") === "true";

  let inputItems: unknown;
  try {
    inputItems = JSON.parse(inputItemsRaw);
  } catch {
    return { error: "계산 결과를 저장할 수 없습니다. 다시 계산해주세요." };
  }

  if (!paperW || !paperH || !Array.isArray(inputItems) || inputItems.length === 0) {
    return { error: "저장할 계산 결과가 없습니다." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("paper_calculations").insert({
    sales_order_id: salesOrderId,
    paper_w: paperW,
    paper_h: paperH,
    input_items: inputItems,
    total_paper: totalPaper,
    total_sheet: totalSheet,
    total_prod: totalProd,
    over_prod: overProd,
    fulfilled,
    created_by: user?.id ?? null,
  });

  if (error) {
    return { error: "저장에 실패했습니다." };
  }

  revalidatePath("/paper-calc");
  if (salesOrderId) revalidatePath(`/sales/${salesOrderId}`);

  return { success: "이 출고 건에 계산 결과를 저장했습니다." };
}

export async function deletePaperCalculation(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  const salesOrderId = String(formData.get("salesOrderId") ?? "").trim() || null;
  if (!id) {
    return { error: "잘못된 요청입니다." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("paper_calculations").delete().eq("id", id);

  if (error) {
    return { error: "삭제에 실패했습니다." };
  }

  revalidatePath("/paper-calc");
  if (salesOrderId) revalidatePath(`/sales/${salesOrderId}`);

  return { success: "삭제했습니다." };
}
