"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  syncPaperStockOrderItem,
  syncPaperStockPurchaseItem,
  PAPER_STOCK_SKU,
} from "@/lib/paper-calc-sync";
import type { FormState } from "@/components/form-message";
import { canManageOrder } from "@/lib/can-manage-order";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// 모조지 계산 결과를 매출/매입 주문에 반영하면 sales_order_items/
// purchase_order_items를 직접 건드리는데, 그 테이블의 RLS가 "그 주문의
// 작성자 또는 관리자"로 좁혀져 있다(owner_or_admin_write_restrictions
// 마이그레이션). 화면에 링크를 숨기는 것만으로는 URL로 직접 들어오는
// 경우까지 막지 못하므로, 실제로 반영을 시도하기 전에 여기서 한 번 더
// 확인해서 남의 주문에는 계산 결과가 반영되지 않게 막는다.
async function assertCanManageOrder(
  supabase: SupabaseServerClient,
  salesOrderId: string | null,
  purchaseOrderId: string | null
): Promise<string | null> {
  if (salesOrderId && !(await canManageOrder(supabase, "sales_orders", salesOrderId))) {
    return "본인이 등록한 매출 건에만 모조지 계산을 반영할 수 있습니다.";
  }
  if (purchaseOrderId && !(await canManageOrder(supabase, "purchase_orders", purchaseOrderId))) {
    return "본인이 등록한 매입 건에만 모조지 계산을 반영할 수 있습니다.";
  }
  return null;
}

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

  const permissionError = await assertCanManageOrder(supabase, salesOrderId, purchaseOrderId);
  if (permissionError) return { error: permissionError };

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
    return { error: `저장에 실패했습니다: ${error.message}` };
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

  const permissionError = await assertCanManageOrder(supabase, salesOrderId, purchaseOrderId);
  if (permissionError) return { error: permissionError };

  const { error } = await supabase.from("paper_calculations").delete().eq("id", id);

  if (error) {
    return { error: `삭제에 실패했습니다: ${error.message}` };
  }

  let warning: string | null = null;
  if (purchaseOrderId) {
    warning = await syncPaperStockPurchaseItem(supabase, purchaseOrderId);
    revalidatePath(`/purchases/${purchaseOrderId}`);
    revalidatePath(`/purchases/${purchaseOrderId}/edit`);
  }
  if (salesOrderId) {
    warning = await syncPaperStockOrderItem(supabase, salesOrderId);
    revalidatePath(`/sales/${salesOrderId}`);
    revalidatePath(`/sales/${salesOrderId}/print`);
    revalidatePath(`/sales/${salesOrderId}/edit`);
  }
  revalidatePath("/paper-calc");

  if (warning) return { error: `계산은 삭제했지만 ${PAPER_STOCK_SKU} 품목 수량 갱신에 실패했습니다: ${warning}` };
  return { success: "삭제했습니다." };
}
