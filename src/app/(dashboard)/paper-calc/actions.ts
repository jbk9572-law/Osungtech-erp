"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  syncPaperStockOrderItem,
  syncPaperStockPurchaseItem,
  PAPER_STOCK_SKU,
} from "@/lib/paper-calc-sync";
import type { FormState } from "@/components/form-message";

export async function savePaperCalculation(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const salesOrderId = String(formData.get("salesOrderId") ?? "").trim() || null;
  const purchaseOrderId = String(formData.get("purchaseOrderId") ?? "").trim() || null;
  const paperW = Number(formData.get("paperW"));
  const paperH = Number(formData.get("paperH"));
  const inputItemsRaw = String(formData.get("inputItems") ?? "");
  const layoutsRaw = String(formData.get("layouts") ?? "");
  const totalPaper = Number(formData.get("totalPaper"));
  const totalSheet = Number(formData.get("totalSheet"));
  const totalProd = Number(formData.get("totalProd"));
  const overProd = Number(formData.get("overProd"));
  const fulfilled = formData.get("fulfilled") === "true";

  let inputItems: unknown;
  let layouts: unknown;
  try {
    inputItems = JSON.parse(inputItemsRaw);
    layouts = JSON.parse(layoutsRaw);
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
    purchase_order_id: purchaseOrderId,
    paper_w: paperW,
    paper_h: paperH,
    input_items: inputItems,
    layouts: Array.isArray(layouts) ? layouts : [],
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

  let warning: string | null = null;
  if (salesOrderId) {
    warning = await syncPaperStockOrderItem(supabase, salesOrderId);
    revalidatePath(`/sales/${salesOrderId}`);
    revalidatePath(`/sales/${salesOrderId}/print`);
    revalidatePath(`/sales/${salesOrderId}/edit`);
  }
  if (purchaseOrderId) {
    warning = await syncPaperStockPurchaseItem(supabase, purchaseOrderId);
    revalidatePath(`/purchases/${purchaseOrderId}`);
    revalidatePath(`/purchases/${purchaseOrderId}/edit`);
  }
  revalidatePath("/paper-calc");

  if (warning) return { error: warning };
  return {
    success: salesOrderId
      ? `이 출고 건에 계산 결과를 저장했습니다. 판매 품목의 ${PAPER_STOCK_SKU} 수량도 갱신했습니다.`
      : purchaseOrderId
        ? `이 매입 건에 계산 결과를 저장했습니다. 매입 품목의 ${PAPER_STOCK_SKU} 수량도 갱신했습니다.`
        : "계산 결과를 저장했습니다.",
  };
}

export async function deletePaperCalculation(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  const salesOrderId = String(formData.get("salesOrderId") ?? "").trim() || null;
  const purchaseOrderId = String(formData.get("purchaseOrderId") ?? "").trim() || null;
  if (!id) {
    return { error: "잘못된 요청입니다." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("paper_calculations").delete().eq("id", id);

  if (error) {
    return { error: "삭제에 실패했습니다." };
  }

  if (purchaseOrderId) {
    await syncPaperStockPurchaseItem(supabase, purchaseOrderId);
    revalidatePath(`/purchases/${purchaseOrderId}`);
    revalidatePath(`/purchases/${purchaseOrderId}/edit`);
  }
  if (salesOrderId) {
    await syncPaperStockOrderItem(supabase, salesOrderId);
    revalidatePath(`/sales/${salesOrderId}`);
    revalidatePath(`/sales/${salesOrderId}/print`);
    revalidatePath(`/sales/${salesOrderId}/edit`);
  }
  revalidatePath("/paper-calc");

  return { success: "삭제했습니다." };
}
