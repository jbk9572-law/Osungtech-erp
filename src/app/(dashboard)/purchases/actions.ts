"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  attachCopiedPaperCalculations,
  attachCopiedPaperCalculationsToPurchase,
  attachPendingPaperCalculation,
  attachPendingPaperCalculationToPurchase,
  overridePurchasePaperStockQuantity,
  overrideSalesPaperStockQuantity,
  revertPurchasePaperStockOverride,
  type PendingCalc,
} from "@/lib/paper-calc-sync";
import { markTodoSideDone } from "@/lib/todo-flow";
import type { FormState } from "@/components/form-message";

type PurchaseItemInput = {
  productId: string;
  spec?: string | null;
  quantity: number;
  unitCost: number;
  remark?: string | null;
};

type SaleItemInput = {
  productId: string;
  spec?: string | null;
  quantity: number;
  remark?: string | null;
};

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

function parseItems(itemsRaw: string): PurchaseItemInput[] | null {
  try {
    const items = JSON.parse(itemsRaw) as PurchaseItemInput[];
    return items.filter((item) => item.productId && item.quantity > 0);
  } catch {
    return null;
  }
}

function parseSaleItems(itemsRaw: string): SaleItemInput[] | null {
  try {
    const items = JSON.parse(itemsRaw) as SaleItemInput[];
    return items.filter((item) => item.productId && item.quantity > 0);
  } catch {
    return null;
  }
}

// 품목별 수량 합계 맵 — 출고 수량이 매입 수량을 넘는지 미리(DB까지 가기 전에)
// 확인해서 더 친절한 오류 메시지를 보여주기 위한 용도. 실제 안전장치는
// create_purchase_and_sale_with_items 함수 안의 검증이다(여기서는 못 걸러도
// 거기서 막힌다).
function sumQuantityByProduct(items: { productId: string; quantity: number }[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of items) {
    map.set(item.productId, (map.get(item.productId) ?? 0) + item.quantity);
  }
  return map;
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

// 당일 입고된 품목을 그대로 매출/할일로 옮겨 담을 수 있게, 특정 거래일자에
// 입고된 매입 품목 목록을 불러온다. 모조지처럼 당일 입고 후 바로 당일
// 출고되는 품목을 이중 입력하지 않아도 되게 하려는 용도다.
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
// 새 매출 건/할일에도 그대로 붙일 수 있게 한다.
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

// 기존 매입 건의 입고 효과를 재고 조정(adjustment)으로 되돌린다.
// 호출 전에 미리 읽어둔 품목/창고 정보를 받는다 (주문을 지우거나 바꾸고 나면
// 원래 품목 수량을 알 수 없기 때문에, 실제 삭제/수정이 성공한 뒤에만 호출해야 한다).
// 반환값이 null이 아니면 재고 반영에 실패한 것이므로 반드시 사용자에게 알려야 한다.
async function reversePurchaseInventory(
  supabase: SupabaseServerClient,
  purchaseOrderId: string,
  warehouseId: string,
  items: { product_id: string; quantity: number }[],
  userId: string | null
): Promise<string | null> {
  if (!items.length) return null;

  const { error } = await supabase.from("inventory_transactions").insert(
    items.map((item) => ({
      product_id: item.product_id,
      warehouse_id: warehouseId,
      type: "adjustment" as const,
      quantity: -item.quantity,
      reference: `purchase_order_reversal:${purchaseOrderId}`,
      created_by: userId,
    }))
  );

  return error ? error.message : null;
}

export async function createPurchase(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const supplierId = String(formData.get("supplier_id") ?? "");
  const warehouseId = String(formData.get("warehouse_id") ?? "");
  const purchaseDate = String(formData.get("purchase_date") ?? "");
  const memo = String(formData.get("memo") ?? "") || null;
  const items = parseItems(String(formData.get("items") ?? "[]"));
  const pendingPaperCalc = String(formData.get("pendingPaperCalc") ?? "") || null;
  // 할일 가져오기로 가져온 모조지 계산(사이즈별 배치 내역, 여러 건일 수 있음).
  const copiedPaperCalcs = String(formData.get("copiedPaperCalcs") ?? "") || null;
  // 할일 가져오기로 채운 할일 id들 — 등록이 실제로 성공하면 해당 할일의
  // 매입 방향을 완료 처리한다(유형에 따라 할일 자체가 완료될 수도 있음).
  const importedTodoIdsRaw = String(formData.get("importedTodoIds") ?? "");
  // 등록 화면에서 TG0 자동 반영 수량을 직접 고친 경우(거래처 협의 등)에만
  // 값이 들어온다 — 있으면 주문 생성 직후 오버라이드 이력을 남긴다.
  const tg0OverrideRaw = String(formData.get("tg0OverrideQuantity") ?? "");
  // 당일 입고 후 바로 출고되는 건을 위해, 매입 등록과 동시에 매출 전표까지
  // 한 번에 만든다. 출고 수량은 매입 수량과 별도로 받는다 — 매입한 수량
  // 전부가 아니라 일부만 당일 출고되고 나머지는 재고로 남는 경우가 있기
  // 때문이다(품목별로 다를 수 있음).
  const alsoCreateSale = String(formData.get("alsoCreateSale") ?? "") === "1";
  const saleCustomerId = String(formData.get("sale_customer_id") ?? "").trim();
  const saleDate = String(formData.get("sale_date") ?? "").trim() || purchaseDate;
  const saleItems = alsoCreateSale ? parseSaleItems(String(formData.get("sale_items") ?? "[]")) : [];

  if (!supplierId || !warehouseId || !purchaseDate) {
    return { error: "공급업체, 창고, 매입일자를 모두 입력해주세요." };
  }
  if (!items) {
    return { error: "품목 정보를 처리하지 못했습니다." };
  }
  // 모조지 계산을 미리 연결해둔 경우, 그 계산이 만들 TG0 품목 한 줄로도
  // 충분하므로 여기서는 수동 품목이 0개여도 등록을 막지 않는다.
  if (items.length === 0 && !pendingPaperCalc && !copiedPaperCalcs) {
    return { error: "품목을 1개 이상 선택하고 수량을 입력해주세요." };
  }
  if (alsoCreateSale && !saleCustomerId) {
    return { error: "매출도 같이 등록하려면 출고처(거래처)를 선택해주세요." };
  }
  if (alsoCreateSale && !saleItems) {
    return { error: "출고 품목 정보를 처리하지 못했습니다." };
  }
  if (alsoCreateSale && saleItems && saleItems.length === 0 && !pendingPaperCalc && !copiedPaperCalcs) {
    return { error: "출고할 품목을 1개 이상 선택하고 수량을 입력해주세요." };
  }
  // 출고 수량이 매입 수량보다 많은 품목이 있으면 실제로 없는 재고를 출고
  // 처리하게 되므로 미리 막는다 — 최종 안전장치는
  // create_purchase_and_sale_with_items 함수 안의 검증이고, 여기서는 더
  // 친절한 메시지를 먼저 보여주기 위한 것이다.
  if (alsoCreateSale && saleItems && saleItems.length > 0) {
    const purchaseQtyByProduct = sumQuantityByProduct(items);
    for (const [productId, saleQty] of sumQuantityByProduct(saleItems)) {
      if (saleQty > (purchaseQtyByProduct.get(productId) ?? 0)) {
        return { error: "출고 수량이 매입 수량보다 많은 품목이 있습니다. 수량을 확인해주세요." };
      }
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let purchaseOrderId: string;
  let salesOrderId: string | null = null;

  if (alsoCreateSale && saleItems) {
    // 매입+매출을 함수 하나로 묶어서 원자적으로 처리한다 — 따로 호출하면
    // 매입이 커밋된 뒤 매출 쪽만 실패해서 매입만 영구히 남는 불일치가
    // 생길 수 있다. 단가는 출고처의 거래처 단가(customer_product_prices)를
    // 우선 쓰고, 없으면 품목 기본 판매단가로 채운다.
    const saleProductIds = saleItems.map((item) => item.productId);
    const [{ data: customerPrices }, { data: productRows }] = await Promise.all([
      saleProductIds.length
        ? supabase
            .from("customer_product_prices")
            .select("product_id, unit_price")
            .eq("customer_id", saleCustomerId)
            .in("product_id", saleProductIds)
        : Promise.resolve({ data: [] as { product_id: string; unit_price: number }[] }),
      saleProductIds.length
        ? supabase.from("products").select("id, price").in("id", saleProductIds)
        : Promise.resolve({ data: [] as { id: string; price: number }[] }),
    ]);
    const priceByProduct = new Map((customerPrices ?? []).map((p) => [p.product_id, Number(p.unit_price)]));
    const defaultPriceByProduct = new Map((productRows ?? []).map((p) => [p.id, Number(p.price)]));

    const { data, error } = await supabase
      .rpc("create_purchase_and_sale_with_items", {
        p_supplier_id: supplierId,
        p_customer_id: saleCustomerId,
        p_warehouse_id: warehouseId,
        p_purchase_date: purchaseDate,
        p_sale_date: saleDate,
        p_purchase_memo: memo,
        p_sale_memo: memo,
        p_created_by: user?.id ?? null,
        p_purchase_items: items.map((item) => ({
          productId: item.productId,
          spec: item.spec || null,
          quantity: item.quantity,
          unitCost: item.unitCost,
          remark: item.remark || null,
        })),
        p_sale_items: saleItems.map((item) => ({
          productId: item.productId,
          spec: item.spec || null,
          quantity: item.quantity,
          unitPrice: priceByProduct.get(item.productId) ?? defaultPriceByProduct.get(item.productId) ?? 0,
          remark: item.remark || null,
        })),
      })
      .single();

    if (error || !data) {
      return { error: `매입+매출 등록에 실패했습니다: ${error?.message ?? "알 수 없는 오류"}` };
    }
    purchaseOrderId = data.purchase_order_id;
    salesOrderId = data.sale_order_id;
  } else {
    // 주문/품목/재고 반영을 DB 함수 하나로 묶어서 원자적으로 처리한다 —
    // 이전에는 세 단계를 개별 요청으로 보내고 실패 시 수동으로 delete해
    // 되돌렸는데, 그 되돌리기 자체가 실패하면 고아 데이터가 남을 수 있었다.
    const { data: newPurchaseId, error } = await supabase.rpc("create_purchase_with_items", {
      p_supplier_id: supplierId,
      p_warehouse_id: warehouseId,
      p_purchase_date: purchaseDate,
      p_memo: memo,
      p_created_by: user?.id ?? null,
      p_items: items.map((item) => ({
        productId: item.productId,
        spec: item.spec || null,
        quantity: item.quantity,
        unitCost: item.unitCost,
        remark: item.remark || null,
      })),
    });

    if (error || !newPurchaseId) {
      return { error: `매입 거래 등록에 실패했습니다: ${error?.message ?? "알 수 없는 오류"}` };
    }
    purchaseOrderId = newPurchaseId;
  }

  await Promise.all(
    items.map((item) =>
      supabase.from("products").update({ cost: item.unitCost }).eq("id", item.productId)
    )
  );

  if (pendingPaperCalc) {
    await attachPendingPaperCalculationToPurchase(supabase, purchaseOrderId, pendingPaperCalc);
  }

  // 할일 가져오기로 가져온 모조지 계산(들)이 있으면 같은 방식으로 붙인다.
  if (copiedPaperCalcs) {
    await attachCopiedPaperCalculationsToPurchase(supabase, purchaseOrderId, copiedPaperCalcs);
  }

  // TG0 자동 반영 줄이 위에서 이미 만들어진 뒤에만 오버라이드를 적용할 수
  // 있으므로 반드시 attachPendingPaperCalculationToPurchase 다음에 호출한다.
  const tg0OverrideQuantity = Number(tg0OverrideRaw);
  if (tg0OverrideRaw && Number.isFinite(tg0OverrideQuantity) && tg0OverrideQuantity > 0) {
    await overridePurchasePaperStockQuantity(supabase, purchaseOrderId, tg0OverrideQuantity, "등록 시 직접 입력");
  }

  // 매출도 같이 만들어졌으면(원자적으로 이미 성공한 상태) 모조지 계산도
  // 매출 쪽에 똑같이 복사해서 TG0 자동 반영/도면까지 그대로 이어준다.
  if (salesOrderId) {
    if (pendingPaperCalc) {
      await attachPendingPaperCalculation(supabase, salesOrderId, pendingPaperCalc);
    }
    if (copiedPaperCalcs) {
      await attachCopiedPaperCalculations(supabase, salesOrderId, copiedPaperCalcs);
    }
    if (tg0OverrideRaw && Number.isFinite(tg0OverrideQuantity) && tg0OverrideQuantity > 0) {
      await overrideSalesPaperStockQuantity(supabase, salesOrderId, tg0OverrideQuantity, "등록 시 직접 입력");
    }
    revalidatePath("/sales");
  }

  // 할일 가져오기로 채웠던 할일들의 매입 방향을 완료 처리한다. 등록이 실제로
  // 성공한 이 시점에만 찍는다 — 가져오기만 하고 등록을 취소하면 남아있어야
  // 한다. 매출까지 같이 등록됐으면(원자적으로 이미 확정) 매출 방향도 같이
  // 완료 처리한다.
  if (importedTodoIdsRaw) {
    try {
      const todoIds = JSON.parse(importedTodoIdsRaw);
      if (Array.isArray(todoIds)) {
        for (const todoId of todoIds) {
          if (typeof todoId === "string" && todoId) {
            await markTodoSideDone(supabase, todoId, "purchase");
            if (salesOrderId) {
              await markTodoSideDone(supabase, todoId, "sale");
            }
          }
        }
      }
    } catch {
      // 무시: 할일 완료 처리는 부가 동작이라 등록 자체를 막지 않는다.
    }
    revalidatePath("/todos");
  }

  revalidatePath("/purchases");
  revalidatePath("/inventory");
  revalidatePath("/products");
  revalidatePath("/dashboard");

  redirect(`/purchases/${purchaseOrderId}`);
}

export async function updatePurchase(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  const supplierId = String(formData.get("supplier_id") ?? "");
  const warehouseId = String(formData.get("warehouse_id") ?? "");
  const purchaseDate = String(formData.get("purchase_date") ?? "");
  const memo = String(formData.get("memo") ?? "") || null;
  const items = parseItems(String(formData.get("items") ?? "[]"));

  if (!id || !supplierId || !warehouseId || !purchaseDate) {
    return { error: "공급업체, 창고, 매입일자를 모두 입력해주세요." };
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
    supabase.from("purchase_order_items").select("product_id, quantity").eq("purchase_order_id", id),
    supabase.from("purchase_orders").select("warehouse_id").eq("id", id).maybeSingle(),
  ]);

  if (!oldOrder) {
    return { error: "매입 거래를 찾을 수 없습니다." };
  }

  // 헤더 수정이 실제로 성공한 경우에만 재고에 손을 댄다 (RLS 등으로 수정이
  // 막혀 있으면 재고만 잘못 되돌아가는 사고를 방지).
  const { error } = await supabase
    .from("purchase_orders")
    .update({
      supplier_id: supplierId,
      warehouse_id: warehouseId,
      purchase_date: purchaseDate,
      memo,
    })
    .eq("id", id);

  if (error) {
    return { error: "매입 거래 수정에 실패했습니다." };
  }

  const reverseError = await reversePurchaseInventory(
    supabase,
    id,
    oldOrder.warehouse_id,
    oldItems ?? [],
    user?.id ?? null
  );
  if (reverseError) {
    return { error: `기존 재고 반영을 되돌리지 못해 수정을 중단했습니다: ${reverseError}` };
  }

  const { error: deleteItemsError } = await supabase
    .from("purchase_order_items")
    .delete()
    .eq("purchase_order_id", id);
  if (deleteItemsError) {
    return { error: `기존 품목 삭제에 실패했습니다: ${deleteItemsError.message}` };
  }

  const { error: itemsError } = await supabase.from("purchase_order_items").insert(
    items.map((item) => ({
      purchase_order_id: id,
      product_id: item.productId,
      spec: item.spec || null,
      quantity: item.quantity,
      unit_cost: item.unitCost,
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
      type: "in" as const,
      quantity: item.quantity,
      reference: `purchase_order:${id}`,
      purchase_order_id: id,
      created_by: user?.id ?? null,
    }))
  );
  if (invError) {
    return { error: `재고 반영에 실패했습니다: ${invError.message}` };
  }

  await Promise.all(
    items.map((item) =>
      supabase.from("products").update({ cost: item.unitCost }).eq("id", item.productId)
    )
  );

  revalidatePath("/purchases");
  revalidatePath(`/purchases/${id}`);
  revalidatePath("/inventory");
  revalidatePath("/products");
  revalidatePath("/dashboard");
  redirect(`/purchases/${id}`);
}

export async function deletePurchase(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
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
    supabase.from("purchase_order_items").select("product_id, quantity").eq("purchase_order_id", id),
    supabase.from("purchase_orders").select("warehouse_id").eq("id", id).maybeSingle(),
  ]);

  if (!order) {
    return { error: "매입 거래를 찾을 수 없습니다." };
  }

  // 삭제가 실제로 성공한 경우에만 재고를 되돌린다.
  const { error } = await supabase.from("purchase_orders").delete().eq("id", id);
  if (error) {
    return { error: "삭제에 실패했습니다." };
  }

  const reverseError = await reversePurchaseInventory(
    supabase,
    id,
    order.warehouse_id,
    items ?? [],
    user?.id ?? null
  );
  if (reverseError) {
    return {
      error: `거래는 삭제되었지만 재고 반영에 실패했습니다: ${reverseError} — 재고 조정 화면에서 직접 확인해주세요.`,
    };
  }

  revalidatePath("/purchases");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  redirect("/purchases");
}

// 자동계산된 TG0(모조지) 수량을 거래처 협의 등의 이유로 수동값으로 고정한다.
// 기본 동작(자동 계산값 반영)은 그대로 두고, 이 값이 적용 중인 동안만
// 재계산이 건너뛰어진다 (paper-calc-sync.ts의 syncPaperStockPurchaseItem 참고).
export async function overridePurchasePaperStock(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const purchaseOrderId = String(formData.get("purchase_order_id") ?? "");
  const overrideQuantity = Number(formData.get("override_quantity") ?? NaN);
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!purchaseOrderId || !Number.isFinite(overrideQuantity) || overrideQuantity <= 0) {
    return { error: "적용할 수량을 올바르게 입력해주세요." };
  }

  const supabase = await createClient();
  const errorMessage = await overridePurchasePaperStockQuantity(
    supabase,
    purchaseOrderId,
    overrideQuantity,
    note
  );
  if (errorMessage) return { error: errorMessage };

  revalidatePath(`/purchases/${purchaseOrderId}`);
  return { success: "모조지 수량을 수동값으로 변경했습니다." };
}

export async function revertPurchasePaperStock(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const purchaseOrderId = String(formData.get("purchase_order_id") ?? "");
  if (!purchaseOrderId) return { error: "잘못된 요청입니다." };

  const supabase = await createClient();
  const errorMessage = await revertPurchasePaperStockOverride(supabase, purchaseOrderId);
  if (errorMessage) return { error: errorMessage };

  revalidatePath(`/purchases/${purchaseOrderId}`);
  return { success: "자동 계산값으로 되돌렸습니다." };
}
