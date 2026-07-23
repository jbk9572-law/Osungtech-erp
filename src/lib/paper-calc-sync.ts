import type { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.types";

export const PAPER_STOCK_SKU = "TG0";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// 이 주문에 현재 적용 중인 수동 오버라이드가 있으면 그 수량을 돌려주고,
// 없으면 null을 돌려준다. reverted_at이 비어있는 가장 최근 행이 "지금
// 적용 중"인 값이다.
async function getActiveOverrideQuantity(
  supabase: SupabaseServerClient,
  orderColumn: "sales_order_id" | "purchase_order_id",
  orderId: string
): Promise<number | null> {
  const { data } = await supabase
    .from("paper_stock_overrides")
    .select("override_quantity")
    .eq(orderColumn, orderId)
    .is("reverted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.override_quantity ?? null;
}

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
    // 수동 오버라이드가 적용 중이면(거래처 협의로 다른 수량 청구 등) 자동
    // 재계산으로 덮어쓰지 않는다 — 오버라이드를 해제해야만 자동값이 다시 반영된다.
    const overrideQuantity = await getActiveOverrideQuantity(supabase, "sales_order_id", salesOrderId);
    if (overrideQuantity === null) {
      await supabase
        .from("sales_order_items")
        .update({ quantity: totalReams })
        .eq("id", existingItem.id);
    }
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
  const pending = parsePendingCalc(pendingRaw);
  if (!pending) return;

  const { error } = await supabase.from("paper_calculations").insert({
    sales_order_id: salesOrderId,
    ...pendingToRow(pending),
    created_by: await getUserId(supabase),
  });

  if (!error) {
    await syncPaperStockOrderItem(supabase, salesOrderId);
  }
}

// 오늘 입고된 모조지(TG0) 품목을 매출로 그대로 옮겨 담을 때, 그 매입 건에
// 연결돼 있던 모조지 계산(사이즈별 배치 내역)도 그대로 복사해서 새 매출
// 건에 붙인다 — attachPendingPaperCalculation과 달리 한 건이 아니라 여러
// 계산을 한 번에 붙일 수 있다(매입 건 하나에 계산이 여러 번 저장됐을 수 있음).
export async function attachCopiedPaperCalculations(
  supabase: SupabaseServerClient,
  salesOrderId: string,
  copiedRaw: string
) {
  let candidates: unknown[];
  try {
    const parsed = JSON.parse(copiedRaw);
    if (!Array.isArray(parsed)) return;
    candidates = parsed;
  } catch {
    return;
  }

  const userId = await getUserId(supabase);
  let insertedAny = false;
  for (const candidate of candidates) {
    if (!isPendingCalc(candidate)) continue;
    const { error } = await supabase.from("paper_calculations").insert({
      sales_order_id: salesOrderId,
      ...pendingToRow(candidate),
      created_by: userId,
    });
    if (!error) insertedAny = true;
  }

  if (insertedAny) {
    await syncPaperStockOrderItem(supabase, salesOrderId);
  }
}

// 원지(TG0) 사용량을 이 매입 건에 저장된 계산들의 합계(연)로 매입 품목에
// 자동 반영한다. syncPaperStockOrderItem과 동일한 이유로, 계산 저장/삭제
// 때마다 "이 주문에 저장된 모든 계산의 합"으로 TG0 한 줄만 다시 갱신한다.
export async function syncPaperStockPurchaseItem(
  supabase: SupabaseServerClient,
  purchaseOrderId: string
) {
  const { data: product } = await supabase
    .from("products")
    .select("id, cost")
    .eq("sku", PAPER_STOCK_SKU)
    .maybeSingle();

  if (!product) {
    return `품목관리에 SKU '${PAPER_STOCK_SKU}'(모조지) 품목이 없어서 매입 품목에는 반영하지 못했습니다.`;
  }

  const { data: calcs } = await supabase
    .from("paper_calculations")
    .select("total_sheet")
    .eq("purchase_order_id", purchaseOrderId);

  const totalReams = (calcs ?? []).reduce((sum, c) => sum + c.total_sheet, 0);

  const { data: existingItem } = await supabase
    .from("purchase_order_items")
    .select("id")
    .eq("purchase_order_id", purchaseOrderId)
    .eq("product_id", product.id)
    .maybeSingle();

  if (totalReams <= 0) {
    if (existingItem) {
      await supabase.from("purchase_order_items").delete().eq("id", existingItem.id);
    }
    return null;
  }

  if (existingItem) {
    const overrideQuantity = await getActiveOverrideQuantity(supabase, "purchase_order_id", purchaseOrderId);
    if (overrideQuantity === null) {
      await supabase
        .from("purchase_order_items")
        .update({ quantity: totalReams })
        .eq("id", existingItem.id);
    }
    return null;
  }

  await supabase.from("purchase_order_items").insert({
    purchase_order_id: purchaseOrderId,
    product_id: product.id,
    quantity: totalReams,
    unit_cost: product.cost,
  });

  return null;
}

// TG0 자동반영 수량을 거래처 협의 등의 이유로 수동값으로 고정한다. 이전에
// 적용 중이던 오버라이드가 있으면 새 값으로 갈아치우는 셈이라 먼저 되돌림
// 처리하고, 새 이력을 남긴 뒤 실제 품목 수량도 그 값으로 바로 바꾼다.
export async function overrideSalesPaperStockQuantity(
  supabase: SupabaseServerClient,
  salesOrderId: string,
  overrideQuantity: number,
  note: string | null
): Promise<string | null> {
  const { data: product } = await supabase
    .from("products")
    .select("id")
    .eq("sku", PAPER_STOCK_SKU)
    .maybeSingle();
  if (!product) return `품목관리에 SKU '${PAPER_STOCK_SKU}'(모조지) 품목이 없습니다.`;

  const { data: calcs } = await supabase
    .from("paper_calculations")
    .select("total_sheet")
    .eq("sales_order_id", salesOrderId);
  const autoQuantity = (calcs ?? []).reduce((sum, c) => sum + c.total_sheet, 0);

  const { data: existingItem } = await supabase
    .from("sales_order_items")
    .select("id")
    .eq("sales_order_id", salesOrderId)
    .eq("product_id", product.id)
    .maybeSingle();
  if (!existingItem) {
    return "적용할 모조지(TG0) 품목이 이 주문에 없습니다. 모조지 계산을 먼저 저장해주세요.";
  }

  await supabase
    .from("paper_stock_overrides")
    .update({ reverted_at: new Date().toISOString() })
    .eq("sales_order_id", salesOrderId)
    .is("reverted_at", null);

  const userId = await getUserId(supabase);
  const { error } = await supabase.from("paper_stock_overrides").insert({
    sales_order_id: salesOrderId,
    auto_quantity: autoQuantity,
    override_quantity: overrideQuantity,
    note,
    created_by: userId,
  });
  if (error) return "오버라이드 저장에 실패했습니다.";

  await supabase.from("sales_order_items").update({ quantity: overrideQuantity }).eq("id", existingItem.id);
  return null;
}

export async function revertSalesPaperStockOverride(
  supabase: SupabaseServerClient,
  salesOrderId: string
): Promise<string | null> {
  const { error } = await supabase
    .from("paper_stock_overrides")
    .update({ reverted_at: new Date().toISOString() })
    .eq("sales_order_id", salesOrderId)
    .is("reverted_at", null);
  if (error) return "되돌리기에 실패했습니다.";

  await syncPaperStockOrderItem(supabase, salesOrderId);
  return null;
}

export async function overridePurchasePaperStockQuantity(
  supabase: SupabaseServerClient,
  purchaseOrderId: string,
  overrideQuantity: number,
  note: string | null
): Promise<string | null> {
  const { data: product } = await supabase
    .from("products")
    .select("id")
    .eq("sku", PAPER_STOCK_SKU)
    .maybeSingle();
  if (!product) return `품목관리에 SKU '${PAPER_STOCK_SKU}'(모조지) 품목이 없습니다.`;

  const { data: calcs } = await supabase
    .from("paper_calculations")
    .select("total_sheet")
    .eq("purchase_order_id", purchaseOrderId);
  const autoQuantity = (calcs ?? []).reduce((sum, c) => sum + c.total_sheet, 0);

  const { data: existingItem } = await supabase
    .from("purchase_order_items")
    .select("id")
    .eq("purchase_order_id", purchaseOrderId)
    .eq("product_id", product.id)
    .maybeSingle();
  if (!existingItem) {
    return "적용할 모조지(TG0) 품목이 이 주문에 없습니다. 모조지 계산을 먼저 저장해주세요.";
  }

  await supabase
    .from("paper_stock_overrides")
    .update({ reverted_at: new Date().toISOString() })
    .eq("purchase_order_id", purchaseOrderId)
    .is("reverted_at", null);

  const userId = await getUserId(supabase);
  const { error } = await supabase.from("paper_stock_overrides").insert({
    purchase_order_id: purchaseOrderId,
    auto_quantity: autoQuantity,
    override_quantity: overrideQuantity,
    note,
    created_by: userId,
  });
  if (error) return "오버라이드 저장에 실패했습니다.";

  await supabase.from("purchase_order_items").update({ quantity: overrideQuantity }).eq("id", existingItem.id);
  return null;
}

export async function revertPurchasePaperStockOverride(
  supabase: SupabaseServerClient,
  purchaseOrderId: string
): Promise<string | null> {
  const { error } = await supabase
    .from("paper_stock_overrides")
    .update({ reverted_at: new Date().toISOString() })
    .eq("purchase_order_id", purchaseOrderId)
    .is("reverted_at", null);
  if (error) return "되돌리기에 실패했습니다.";

  await syncPaperStockPurchaseItem(supabase, purchaseOrderId);
  return null;
}

// 새 매입 등록 화면에서는 아직 purchase_order_id가 없어서 모조지 계산을
// 미리 저장할 수 없다 — attachPendingPaperCalculation과 동일한 방식으로,
// 주문이 실제로 생성된 직후 이 함수로 한 번에 저장한다.
export async function attachPendingPaperCalculationToPurchase(
  supabase: SupabaseServerClient,
  purchaseOrderId: string,
  pendingRaw: string
) {
  const pending = parsePendingCalc(pendingRaw);
  if (!pending) return;

  const { error } = await supabase.from("paper_calculations").insert({
    purchase_order_id: purchaseOrderId,
    ...pendingToRow(pending),
    created_by: await getUserId(supabase),
  });

  if (!error) {
    await syncPaperStockPurchaseItem(supabase, purchaseOrderId);
  }
}

// 매입 등록도 매출과 마찬가지로 "할일 가져오기"에서 할일에 붙어있던 계산을
// 통째로(여러 건일 수 있음) 복사해올 수 있어야 해서, attachCopiedPaperCalculations와
// 동일한 방식으로 purchase_order_id 버전을 둔다.
export async function attachCopiedPaperCalculationsToPurchase(
  supabase: SupabaseServerClient,
  purchaseOrderId: string,
  copiedRaw: string
) {
  let candidates: unknown[];
  try {
    const parsed = JSON.parse(copiedRaw);
    if (!Array.isArray(parsed)) return;
    candidates = parsed;
  } catch {
    return;
  }

  const userId = await getUserId(supabase);
  let insertedAny = false;
  for (const candidate of candidates) {
    if (!isPendingCalc(candidate)) continue;
    const { error } = await supabase.from("paper_calculations").insert({
      purchase_order_id: purchaseOrderId,
      ...pendingToRow(candidate),
      created_by: userId,
    });
    if (!error) insertedAny = true;
  }

  if (insertedAny) {
    await syncPaperStockPurchaseItem(supabase, purchaseOrderId);
  }
}

// 할일 등록 화면에서도 아직 todo id가 없어서 계산을 미리 저장할 수 없다 —
// 다른 attachPendingPaperCalculation*과 동일한 방식이지만, 할일은 금액/재고
// 개념이 없어 주문 품목에 자동 반영할 필요가 없다(참고용 표시 + 도면 보기만).
export async function attachPendingPaperCalculationToTodo(
  supabase: SupabaseServerClient,
  todoId: string,
  pendingRaw: string
) {
  const pending = parsePendingCalc(pendingRaw);
  if (!pending) return;

  await supabase.from("paper_calculations").insert({
    todo_id: todoId,
    ...pendingToRow(pending),
    created_by: await getUserId(supabase),
  });
}

export type PendingCalc = {
  paperW: number;
  paperH: number;
  inputItems: Json;
  layouts: Json;
  totalPaper: number;
  totalSheet: number;
  totalProd: number;
  overProd: number;
  fulfilled: boolean;
};

function isPendingCalc(value: unknown): value is PendingCalc {
  const pending = value as Partial<PendingCalc> | null;
  return Boolean(
    pending &&
      pending.paperW &&
      pending.paperH &&
      Array.isArray(pending.inputItems) &&
      pending.inputItems.length > 0
  );
}

function parsePendingCalc(pendingRaw: string): PendingCalc | null {
  let pending: unknown;
  try {
    pending = JSON.parse(pendingRaw);
  } catch {
    return null;
  }
  return isPendingCalc(pending) ? pending : null;
}

function pendingToRow(pending: PendingCalc) {
  return {
    paper_w: pending.paperW,
    paper_h: pending.paperH,
    input_items: pending.inputItems,
    layouts: Array.isArray(pending.layouts) ? pending.layouts : [],
    total_paper: pending.totalPaper,
    total_sheet: pending.totalSheet,
    total_prod: pending.totalProd,
    over_prod: pending.overProd,
    fulfilled: pending.fulfilled,
  };
}

async function getUserId(supabase: SupabaseServerClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}
