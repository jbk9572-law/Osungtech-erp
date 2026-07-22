"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  attachCopiedPaperCalculations,
  attachPendingPaperCalculation,
  overrideSalesPaperStockQuantity,
  revertSalesPaperStockOverride,
  type PendingCalc,
} from "@/lib/paper-calc-sync";
import type { FormState } from "@/components/form-message";

type SaleItemInput = {
  productId: string;
  spec?: string | null;
  quantity: number;
  unitPrice: number;
  remark?: string | null;
};

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

function parseItems(itemsRaw: string): SaleItemInput[] | null {
  try {
    const items = JSON.parse(itemsRaw) as SaleItemInput[];
    return items.filter((item) => item.productId && item.quantity > 0);
  } catch {
    return null;
  }
}

export type TodayPurchaseItem = {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  spec: string;
  quantity: number;
  unit: string;
  supplierName: string;
  purchaseOrderId: string;
};

// 당일 입고된 품목을 그대로 매출로 옮겨 담을 수 있게, 새 판매 등록 화면에서
// 특정 거래일자에 입고된 매입 품목 목록을 불러온다. 모조지처럼 당일 입고 후
// 바로 당일 출고되는 품목을 이중 입력하지 않아도 되게 하려는 용도다.
export async function getPurchaseItemsForDate(date: string): Promise<TodayPurchaseItem[]> {
  if (!date) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("purchase_order_items")
    .select(
      "id, product_id, quantity, spec, purchase_order_id, products(sku, name, spec, unit), purchase_orders!inner(purchase_date, suppliers(name))"
    )
    .eq("purchase_orders.purchase_date", date)
    .order("created_at", { ascending: true });

  return (data ?? []).map((item) => ({
    id: item.id,
    productId: item.product_id,
    productName: item.products?.name ?? "상품 미상",
    sku: item.products?.sku ?? "",
    spec: item.spec || item.products?.spec || "",
    quantity: item.quantity,
    unit: item.products?.unit ?? "",
    supplierName: item.purchase_orders?.suppliers?.name ?? "공급처 미상",
    purchaseOrderId: item.purchase_order_id,
  }));
}

// 입고 불러오기에서 모조지(TG0) 품목을 고르면, 수량만 옮기는 게 아니라 그
// 매입 건에 저장돼 있던 모조지 계산(사이즈별 배치 내역) 자체를 가져와
// 새 매출 건에도 그대로 붙일 수 있게 한다.
export async function getPaperCalculationsForPurchaseOrder(
  purchaseOrderId: string
): Promise<PendingCalc[]> {
  if (!purchaseOrderId) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("paper_calculations")
    .select("paper_w, paper_h, input_items, layouts, total_paper, total_sheet, total_prod, over_prod, fulfilled")
    .eq("purchase_order_id", purchaseOrderId);

  return (data ?? []).map((calc) => ({
    paperW: calc.paper_w,
    paperH: calc.paper_h,
    inputItems: calc.input_items,
    layouts: calc.layouts,
    totalPaper: calc.total_paper,
    totalSheet: calc.total_sheet,
    totalProd: calc.total_prod,
    overProd: calc.over_prod,
    fulfilled: calc.fulfilled,
  }));
}

// 기존 판매 건의 출고 효과를 재고 조정(adjustment)으로 되돌린다.
// 호출 전에 미리 읽어둔 품목/창고 정보를 받는다 (주문을 지우거나 바꾸고 나면
// 원래 품목 수량을 알 수 없기 때문에, 실제 삭제/수정이 성공한 뒤에만 호출해야 한다).
// 반환값이 null이 아니면 재고 반영에 실패한 것이므로 반드시 사용자에게 알려야 한다.
async function reverseSaleInventory(
  supabase: SupabaseServerClient,
  salesOrderId: string,
  warehouseId: string,
  items: { product_id: string; quantity: number }[],
  userId: string | null
): Promise<string | null> {
  if (!items.length) return null;

  // 매출은 "출고(out)"로 재고를 차감했으므로, 되돌릴 때는 그만큼 다시
  // 더해줘야 한다 (양수). 여기서 부호가 반대로(음수) 들어가면 삭제/수정할
  // 때마다 재고가 두 번 깎이는 심각한 버그가 된다.
  const { error } = await supabase.from("inventory_transactions").insert(
    items.map((item) => ({
      product_id: item.product_id,
      warehouse_id: warehouseId,
      type: "adjustment" as const,
      quantity: item.quantity,
      reference: `sales_order_reversal:${salesOrderId}`,
      created_by: userId,
    }))
  );

  return error ? error.message : null;
}

export async function createSale(_prevState: FormState, formData: FormData): Promise<FormState> {
  const customerId = String(formData.get("customer_id") ?? "");
  const warehouseId = String(formData.get("warehouse_id") ?? "");
  const orderDate = String(formData.get("order_date") ?? "");
  const memo = String(formData.get("memo") ?? "") || null;
  const items = parseItems(String(formData.get("items") ?? "[]"));
  // 모조지 계산을 미리 연결해둔 경우, 그 계산이 만들 TG0 품목 한 줄로도
  // 충분하므로 여기서는 수동 품목이 0개여도 등록을 막지 않는다.
  const pendingPaperCalc = String(formData.get("pendingPaperCalc") ?? "");
  // 입고 불러오기로 가져온 모조지 계산(사이즈별 배치 내역, 여러 건일 수 있음).
  const copiedPaperCalcs = String(formData.get("copiedPaperCalcs") ?? "");
  // 등록 화면에서 TG0 자동 반영 수량을 직접 고친 경우(거래처 협의 등)에만
  // 값이 들어온다 — 있으면 주문 생성 직후 오버라이드 이력을 남긴다.
  const tg0OverrideRaw = String(formData.get("tg0OverrideQuantity") ?? "");

  if (!customerId || !warehouseId || !orderDate) {
    return { error: "거래처, 창고, 거래일자를 모두 입력해주세요." };
  }
  if (!items) {
    return { error: "품목 정보를 처리하지 못했습니다." };
  }
  if (items.length === 0 && !pendingPaperCalc && !copiedPaperCalcs) {
    return { error: "품목을 1개 이상 선택하고 수량을 입력해주세요." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 주문/품목/재고 반영을 DB 함수 하나로 묶어서 원자적으로 처리한다 —
  // 이전에는 세 단계를 개별 요청으로 보내고 실패 시 수동으로 delete해
  // 되돌렸는데, 그 되돌리기 자체가 실패하면 고아 데이터가 남을 수 있었다.
  const { data: salesOrderId, error } = await supabase.rpc("create_sale_with_items", {
    p_customer_id: customerId,
    p_warehouse_id: warehouseId,
    p_order_date: orderDate,
    p_memo: memo,
    p_created_by: user?.id ?? null,
    p_items: items.map((item) => ({
      productId: item.productId,
      spec: item.spec || null,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      remark: item.remark || null,
    })),
  });

  if (error || !salesOrderId) {
    return { error: `판매 거래 등록에 실패했습니다: ${error?.message ?? "알 수 없는 오류"}` };
  }

  if (items.length > 0) {
    await Promise.all(
      items.map((item) =>
        supabase.from("customer_product_prices").upsert(
          {
            customer_id: customerId,
            product_id: item.productId,
            unit_price: item.unitPrice,
          },
          { onConflict: "customer_id,product_id" }
        )
      )
    );
  }

  // 모조지 계산 화면에서 주문 생성 전에 미리 계산해둔 결과가 있으면
  // (localStorage에 임시 저장 → new-sale-form이 hidden input으로 넘김)
  // 방금 만든 주문에 붙여서 저장하고 TG0 판매 품목에도 반영한다.
  if (pendingPaperCalc) {
    await attachPendingPaperCalculation(supabase, salesOrderId, pendingPaperCalc);
  }

  // 입고 불러오기로 가져온 모조지 계산(들)이 있으면 같은 방식으로 붙인다.
  if (copiedPaperCalcs) {
    await attachCopiedPaperCalculations(supabase, salesOrderId, copiedPaperCalcs);
  }

  // TG0 자동 반영 줄이 위에서 이미 만들어진 뒤에만 오버라이드를 적용할 수
  // 있으므로 반드시 attachPendingPaperCalculation(들) 다음에 호출한다.
  const tg0OverrideQuantity = Number(tg0OverrideRaw);
  if (tg0OverrideRaw && Number.isFinite(tg0OverrideQuantity) && tg0OverrideQuantity > 0) {
    await overrideSalesPaperStockQuantity(supabase, salesOrderId, tg0OverrideQuantity, "등록 시 직접 입력");
  }

  revalidatePath("/sales");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  revalidatePath("/paper-calc");
  redirect(`/sales/${salesOrderId}`);
}

export async function updateSale(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  const customerId = String(formData.get("customer_id") ?? "");
  const warehouseId = String(formData.get("warehouse_id") ?? "");
  const orderDate = String(formData.get("order_date") ?? "");
  const memo = String(formData.get("memo") ?? "") || null;
  const items = parseItems(String(formData.get("items") ?? "[]"));

  if (!id || !customerId || !warehouseId || !orderDate) {
    return { error: "거래처, 창고, 거래일자를 모두 입력해주세요." };
  }
  if (!items) {
    return { error: "품목 정보를 처리하지 못했습니다." };
  }
  if (items.length === 0) {
    return { error: "품목을 1개 이상 선택하고 수량을 입력해주세요." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 재고를 건드리기 전에 기존 품목/창고 정보를 먼저 읽어둔다.
  const [{ data: oldItems }, { data: oldOrder }] = await Promise.all([
    supabase.from("sales_order_items").select("product_id, quantity").eq("sales_order_id", id),
    supabase.from("sales_orders").select("warehouse_id").eq("id", id).maybeSingle(),
  ]);

  if (!oldOrder) {
    return { error: "매출 거래를 찾을 수 없습니다." };
  }

  // 헤더 수정이 실제로 성공한 경우에만 재고에 손을 댄다 (RLS 등으로 수정이
  // 막혀 있으면 재고만 잘못 되돌아가는 사고를 방지).
  const { error } = await supabase
    .from("sales_orders")
    .update({
      customer_id: customerId,
      warehouse_id: warehouseId,
      order_date: orderDate,
      memo,
    })
    .eq("id", id);

  if (error) {
    return { error: "판매 거래 수정에 실패했습니다." };
  }

  const reverseError = await reverseSaleInventory(
    supabase,
    id,
    oldOrder.warehouse_id,
    oldItems ?? [],
    user?.id ?? null
  );
  if (reverseError) {
    return {
      error: `기존 재고 반영을 되돌리지 못해 수정을 중단했습니다: ${reverseError}`,
    };
  }

  const { error: deleteItemsError } = await supabase
    .from("sales_order_items")
    .delete()
    .eq("sales_order_id", id);
  if (deleteItemsError) {
    return { error: `기존 품목 삭제에 실패했습니다: ${deleteItemsError.message}` };
  }

  const { error: itemsError } = await supabase.from("sales_order_items").insert(
    items.map((item) => ({
      sales_order_id: id,
      product_id: item.productId,
      spec: item.spec || null,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      remark: item.remark || null,
    }))
  );
  if (itemsError) {
    return { error: `품목 등록에 실패했습니다: ${itemsError.message}` };
  }

  const { error: invError } = await supabase.from("inventory_transactions").insert(
    items.map((item) => ({
      product_id: item.productId,
      warehouse_id: warehouseId,
      type: "out" as const,
      quantity: item.quantity,
      reference: `sales_order:${id}`,
      sales_order_id: id,
      created_by: user?.id ?? null,
    }))
  );
  if (invError) {
    return { error: `재고 반영에 실패했습니다: ${invError.message}` };
  }

  await Promise.all(
    items.map((item) =>
      supabase.from("customer_product_prices").upsert(
        {
          customer_id: customerId,
          product_id: item.productId,
          unit_price: item.unitPrice,
        },
        { onConflict: "customer_id,product_id" }
      )
    )
  );

  revalidatePath("/sales");
  revalidatePath(`/sales/${id}`);
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  redirect(`/sales/${id}`);
}

export async function deleteSale(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) {
    return { error: "잘못된 요청입니다." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 재고를 되돌리기 전에 삭제될 품목/창고 정보를 먼저 읽어둔다.
  const [{ data: items }, { data: order }] = await Promise.all([
    supabase.from("sales_order_items").select("product_id, quantity").eq("sales_order_id", id),
    supabase.from("sales_orders").select("warehouse_id").eq("id", id).maybeSingle(),
  ]);

  if (!order) {
    return { error: "매출 거래를 찾을 수 없습니다." };
  }

  // 삭제가 실제로 성공한 경우에만 재고를 되돌린다.
  const { error } = await supabase.from("sales_orders").delete().eq("id", id);
  if (error) {
    return { error: "삭제에 실패했습니다." };
  }

  const reverseError = await reverseSaleInventory(
    supabase,
    id,
    order.warehouse_id,
    items ?? [],
    user?.id ?? null
  );
  if (reverseError) {
    return {
      error: `거래는 삭제되었지만 재고 복구에 실패했습니다: ${reverseError} — 재고 조정 화면에서 직접 확인해주세요.`,
    };
  }

  revalidatePath("/sales");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  redirect("/sales");
}

// 자동계산된 TG0(모조지) 수량을 거래처 협의 등의 이유로 수동값으로 고정한다.
// 기본 동작(자동 계산값 반영)은 그대로 두고, 이 값이 적용 중인 동안만
// 재계산이 건너뛰어진다 (paper-calc-sync.ts의 syncPaperStockOrderItem 참고).
export async function overrideSalesPaperStock(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const salesOrderId = String(formData.get("sales_order_id") ?? "");
  const overrideQuantity = Number(formData.get("override_quantity") ?? NaN);
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!salesOrderId || !Number.isFinite(overrideQuantity) || overrideQuantity <= 0) {
    return { error: "적용할 수량을 올바르게 입력해주세요." };
  }

  const supabase = await createClient();
  const errorMessage = await overrideSalesPaperStockQuantity(
    supabase,
    salesOrderId,
    overrideQuantity,
    note
  );
  if (errorMessage) return { error: errorMessage };

  revalidatePath(`/sales/${salesOrderId}`);
  return { success: "모조지 수량을 수동값으로 변경했습니다." };
}

export async function revertSalesPaperStock(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const salesOrderId = String(formData.get("sales_order_id") ?? "");
  if (!salesOrderId) return { error: "잘못된 요청입니다." };

  const supabase = await createClient();
  const errorMessage = await revertSalesPaperStockOverride(supabase, salesOrderId);
  if (errorMessage) return { error: errorMessage };

  revalidatePath(`/sales/${salesOrderId}`);
  return { success: "자동 계산값으로 되돌렸습니다." };
}
