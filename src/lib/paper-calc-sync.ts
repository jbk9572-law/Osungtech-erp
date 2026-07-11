import type { createClient } from "@/lib/supabase/server";

export const PAPER_STOCK_SKU = "TG0";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// 모조지(TG0) 원지 사용량을 이 출고 건에 저장된 계산들의 합계(연)로 판매
// 품목에 자동 반영한다. 계산은 여러 번 저장/삭제될 수 있으므로 매번
// "이 주문에 저장된 모든 계산의 합"으로 다시 계산해서 TG0 한 줄만 갱신한다
// (계산마다 별도 줄을 쌓으면 저장할 때마다 중복 가산되어 버린다).
export async function syncPaperStockOrderItem(supabase: SupabaseServerClient, salesOrderId: string) {
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

// 새 판매 등록 화면에서는 아직 sales_order_id가 없어서 모조지 계산을
// 미리 저장할 수 없다 — 계산 결과를 localStorage에 잠깐 담아뒀다가
// 주문이 실제로 생성된 직후 이 함수로 한 번에 저장한다.
export async function attachPendingPaperCalculation(
  supabase: SupabaseServerClient,
  salesOrderId: string,
  pendingRaw: string
) {
  let pending: {
    paperW: number;
    paperH: number;
    inputItems: unknown;
    layouts: unknown;
    totalPaper: number;
    totalSheet: number;
    totalProd: number;
    overProd: number;
    fulfilled: boolean;
  };
  try {
    pending = JSON.parse(pendingRaw);
  } catch {
    return;
  }

  if (!pending.paperW || !pending.paperH || !Array.isArray(pending.inputItems) || pending.inputItems.length === 0) {
    return;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("paper_calculations").insert({
    sales_order_id: salesOrderId,
    paper_w: pending.paperW,
    paper_h: pending.paperH,
    input_items: pending.inputItems,
    layouts: Array.isArray(pending.layouts) ? pending.layouts : [],
    total_paper: pending.totalPaper,
    total_sheet: pending.totalSheet,
    total_prod: pending.totalProd,
    over_prod: pending.overProd,
    fulfilled: pending.fulfilled,
    created_by: user?.id ?? null,
  });

  if (!error) {
    await syncPaperStockOrderItem(supabase, salesOrderId);
  }
}
