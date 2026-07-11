"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/components/form-message";

const PAPER_STOCK_SKU = "TG0";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// 모조지(TG0) 원지 사용량을 이 출고 건에 저장된 계산들의 합계(연)로 판매
// 품목에 자동 반영한다. 계산은 여러 번 저장/삭제될 수 있으므로 매번
// "이 주문에 저장된 모든 계산의 합"으로 다시 계산해서 TG0 한 줄만 갱신한다
// (계산마다 별도 줄을 쌓으면 저장할 때마다 중복 가산되어 버린다).
async function syncPaperStockOrderItem(supabase: SupabaseServerClient, salesOrderId: string) {
  const { data: product } = await supabase
    .from("products")
    .select("id, price")
    .eq("sku", PAPER_STOCK_SKU)
    .maybeSingle();

  if (!product) {
    return `품목관리에 SKU '${PAPER_STOCK_SKU}'(모조지) 품목이 없어서 판매 품목에는 반영하지 못했습니다.`;
  }

  const { data: calcs } = await supabase
    .from("paper_calculations")
    .select("total_sheet")
    .eq("sales_order_id", salesOrderId);

  const totalReams = (calcs ?? []).reduce((sum, c) => sum + c.total_sheet, 0);

  const { data: existingItem } = await supabase
    .from("sales_order_items")
    .select("id")
    .eq("sales_order_id", salesOrderId)
    .eq("product_id", product.id)
    .maybeSingle();

  if (totalReams <= 0) {
    if (existingItem) {
      await supabase.from("sales_order_items").delete().eq("id", existingItem.id);
    }
    return null;
  }

  if (existingItem) {
    await supabase
      .from("sales_order_items")
      .update({ quantity: totalReams })
      .eq("id", existingItem.id);
    return null;
  }

  const { data: order } = await supabase
    .from("sales_orders")
    .select("customer_id")
    .eq("id", salesOrderId)
    .maybeSingle();

  let unitPrice = product.price;
  if (order) {
    const { data: customerPrice } = await supabase
      .from("customer_product_prices")
      .select("unit_price")
      .eq("customer_id", order.customer_id)
      .eq("product_id", product.id)
      .maybeSingle();
    if (customerPrice) unitPrice = customerPrice.unit_price;
  }

  await supabase.from("sales_order_items").insert({
    sales_order_id: salesOrderId,
    product_id: product.id,
    quantity: totalReams,
    unit_price: unitPrice,
  });

  return null;
}

export async function savePaperCalculation(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const salesOrderId = String(formData.get("salesOrderId") ?? "").trim() || null;
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
  revalidatePath("/paper-calc");

  if (warning) return { error: warning };
  return {
    success: salesOrderId
      ? `이 출고 건에 계산 결과를 저장했습니다. 판매 품목의 ${PAPER_STOCK_SKU} 수량도 갱신했습니다.`
      : "계산 결과를 저장했습니다.",
  };
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

  if (salesOrderId) {
    await syncPaperStockOrderItem(supabase, salesOrderId);
    revalidatePath(`/sales/${salesOrderId}`);
    revalidatePath(`/sales/${salesOrderId}/print`);
    revalidatePath(`/sales/${salesOrderId}/edit`);
  }
  revalidatePath("/paper-calc");

  return { success: "삭제했습니다." };
}
