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
import { resolveListHref } from "@/lib/list-return";
import type { FormState } from "@/components/form-message";
import { canManageOrder } from "@/lib/can-manage-order";

type PurchaseItemInput = {
  productId: string;
  spec?: string | null;
  quantity: number;
  unitCost: number;
  remark?: string | null;
  lotNumber?: string | null;
};

type SaleItemInput = {
  productId: string;
  spec?: string | null;
  quantity: number;
  unitPrice: number;
  remark?: string | null;
  lotNumber?: string | null;
};

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

// "No"(전표번호) 입력칸을 비워두면 자동 채번(DB 시퀀스 기본값)에 맡기고,
// 값을 직접 입력했을 때만 그 번호를 그대로 쓴다.
function parseDocNo(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

// doc_no에는 유니크 제약이 걸려있어, 직접 입력한 번호가 이미 쓰이고
// 있으면 postgres 원문 에러 대신 알아볼 수 있는 안내로 바꿔준다.
function docNoErrorMessage(error: { code?: string; message: string } | null, docNo: number | null): string | null {
  if (error?.code === "23505" && error.message.includes("doc_no") && docNo != null) {
    return `이미 사용 중인 전표번호(No: ${docNo})입니다. 다른 번호를 입력하거나 비워서 자동 채번하세요.`;
  }
  return null;
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
  lotNumber: string;
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
      "id, product_id, quantity, spec, lot_number, purchase_order_id, products(sku, name, spec, unit), purchase_orders!inner(purchase_date, suppliers(name))"
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
    lotNumber: item.lot_number ?? "",
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

export async function createPurchase(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const supplierId = String(formData.get("supplier_id") ?? "");
  const warehouseId = String(formData.get("warehouse_id") ?? "");
  const purchaseDate = String(formData.get("purchase_date") ?? "");
  const memo = String(formData.get("memo") ?? "") || null;
  // "항상 외상" 체크박스가 켜져 있으면(기본값) 폼에서 이 필드를 아예 안
  // 보내서 null(외상)로 저장된다 — 체크를 끄고 결제방법을 고른 경우에만 값이 온다.
  const paymentMethod = String(formData.get("payment_method") ?? "") || null;
  const deliveryMethod = String(formData.get("delivery_method") ?? "") || null;
  const docNo = parseDocNo(String(formData.get("doc_no") ?? ""));
  const isCarryover = formData.get("is_carryover") === "1";
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
    return { error: "공급처, 창고, 매입일자를 모두 입력해주세요." };
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
    return { error: "매출도 같이 등록하려면 출고처를 선택해주세요." };
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
    // 생길 수 있다. 단가는 화면에서 미리 보여준 값을 그대로 신뢰한다
    // (매출 등록 폼과 동일한 방식) — 서버가 다시 조회해서 화면에 안 보인
    // 값으로 몰래 바꾸지 않는다.
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
          lotNumber: item.lotNumber || null,
        })),
        p_sale_items: saleItems.map((item) => ({
          productId: item.productId,
          spec: item.spec || null,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          remark: item.remark || null,
          lotNumber: item.lotNumber || null,
        })),
        p_payment_method: paymentMethod,
        p_delivery_method: deliveryMethod,
        p_purchase_doc_no: docNo,
        // 이 화면엔 매출 전표번호를 따로 입력하는 칸이 없어 항상 자동
        // 채번에 맡긴다 — 값을 아예 안 보내면(키 자체가 없으면) 옛 버전
        // 함수 오버로드가 남아있을 때 PostgREST가 어느 쪽을 불러야 할지
        // 못 정해서 "Could not choose the best candidate function" 오류가
        // 났었다(00000000000067). null이라도 키를 항상 보내서 이 문제가
        // 재발하지 않게 한다.
        p_sale_doc_no: null,
      })
      .single();

    if (error || !data) {
      return { error: docNoErrorMessage(error, docNo) ?? `매입+매출 등록에 실패했습니다: ${error?.message ?? "알 수 없는 오류"}` };
    }
    purchaseOrderId = data.purchase_order_id;
    salesOrderId = data.sale_order_id;

    // 매출 등록 폼과 동일하게, 이번에 실제로 적용한 단가를 거래처별 단가로
    // 저장해둔다 — 다음 등록부터 이 단가가 기본값으로 뜬다.
    await Promise.all(
      saleItems.map((item) =>
        supabase.from("customer_product_prices").upsert(
          {
            customer_id: saleCustomerId,
            product_id: item.productId,
            unit_price: item.unitPrice,
          },
          { onConflict: "customer_id,product_id" }
        )
      )
    );
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
        lotNumber: item.lotNumber || null,
      })),
      p_payment_method: paymentMethod,
      p_delivery_method: deliveryMethod,
      p_doc_no: docNo,
      p_is_carryover: isCarryover,
    });

    if (error || !newPurchaseId) {
      return { error: docNoErrorMessage(error, docNo) ?? `매입 거래 등록에 실패했습니다: ${error?.message ?? "알 수 없는 오류"}` };
    }
    purchaseOrderId = newPurchaseId;
  }

  await Promise.all(
    items.map((item) =>
      supabase.from("products").update({ cost: item.unitCost }).eq("id", item.productId)
    )
  );

  // 매출 등록과 동일하게, 이번에 실제로 적용한 매입단가를 공급처별 단가로도
  // 저장해둔다 — 다음부터 같은 공급처+상품 조합은 이 단가가 기본값으로 뜬다.
  await Promise.all(
    items.map((item) =>
      supabase.from("supplier_product_prices").upsert(
        {
          supplier_id: supplierId,
          product_id: item.productId,
          unit_cost: item.unitCost,
        },
        { onConflict: "supplier_id,product_id" }
      )
    )
  );

  // 이 단계가 실패해도 매입 등록 자체는 이미 성공했으니 등록을 막지 않되,
  // 조용히 묻히지 않도록 상세 화면으로 경고 메시지를 실어 보낸다.
  let paperCalcWarning: string | null = null;
  if (pendingPaperCalc) {
    paperCalcWarning = await attachPendingPaperCalculationToPurchase(supabase, purchaseOrderId, pendingPaperCalc);
  }

  // 할일 가져오기로 가져온 모조지 계산(들)이 있으면 같은 방식으로 붙인다.
  if (copiedPaperCalcs) {
    paperCalcWarning ??= await attachCopiedPaperCalculationsToPurchase(
      supabase,
      purchaseOrderId,
      copiedPaperCalcs
    );
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
      paperCalcWarning ??= await attachPendingPaperCalculation(supabase, salesOrderId, pendingPaperCalc);
    }
    if (copiedPaperCalcs) {
      paperCalcWarning ??= await attachCopiedPaperCalculations(supabase, salesOrderId, copiedPaperCalcs);
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
  revalidatePath("/payables");
  revalidatePath(`/suppliers/${supplierId}`);

  redirect(
    paperCalcWarning
      ? `/purchases/${purchaseOrderId}?warning=${encodeURIComponent(paperCalcWarning)}`
      : `/purchases/${purchaseOrderId}`
  );
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
  const paymentMethod = String(formData.get("payment_method") ?? "") || null;
  const deliveryMethod = String(formData.get("delivery_method") ?? "") || null;
  const docNo = parseDocNo(String(formData.get("doc_no") ?? ""));
  const isCarryover = formData.get("is_carryover") === "1";
  const items = parseItems(String(formData.get("items") ?? "[]"));
  // 목록에서 검색/필터를 걸어둔 채로 상세 → 수정으로 들어왔으면, 저장 후
  // 상세가 아니라 그 목록으로 돌아간다.
  const back = String(formData.get("back") ?? "") || undefined;

  if (!id || !supplierId || !warehouseId || !purchaseDate) {
    return { error: "공급처, 창고, 매입일자를 모두 입력해주세요." };
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

  // 헤더 수정 + 기존 재고 되돌리기 + 품목 교체 + 새 재고 반영을 DB 함수
  // 하나로 묶어 원자적으로 처리한다 — createPurchase와 같은 이유로, 이전에는
  // 이 단계들을 개별 요청으로 보내서 중간(특히 "새 품목 삽입")에 실패하면
  // 헤더/재고는 이미 바뀌었는데 품목이 0개로 남는 불일치가 생길 수 있었다.
  const { error } = await supabase.rpc("update_purchase_with_items", {
    p_id: id,
    p_supplier_id: supplierId,
    p_warehouse_id: warehouseId,
    p_purchase_date: purchaseDate,
    p_memo: memo,
    p_updated_by: user?.id ?? null,
    p_items: items.map((item) => ({
      productId: item.productId,
      spec: item.spec || null,
      quantity: item.quantity,
      unitCost: item.unitCost,
      remark: item.remark || null,
      lotNumber: item.lotNumber || null,
    })),
    p_payment_method: paymentMethod,
    p_delivery_method: deliveryMethod,
    p_doc_no: docNo,
    p_is_carryover: isCarryover,
  });

  if (error) {
    return { error: docNoErrorMessage(error, docNo) ?? `매입 거래 수정에 실패했습니다: ${error.message}` };
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
  revalidatePath("/payables");
  revalidatePath(`/suppliers/${supplierId}`);
  redirect(back ? resolveListHref("/purchases", back) : `/purchases/${id}`);
}

export async function bulkDeletePurchases(_prevState: FormState, formData: FormData): Promise<FormState> {
  let ids: string[];
  try {
    ids = JSON.parse(String(formData.get("ids") ?? "[]"));
  } catch {
    return { error: "잘못된 요청입니다." };
  }
  if (!Array.isArray(ids) || ids.length === 0) {
    return { error: "삭제할 항목을 선택해주세요." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: orders } = await supabase.from("purchase_orders").select("supplier_id").in("id", ids);

  const results = await Promise.all(
    ids.map((id) => supabase.rpc("delete_purchase_with_items", { p_id: id, p_deleted_by: user?.id ?? null }))
  );
  const failCount = results.filter((r) => r.error).length;

  revalidatePath("/purchases");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  revalidatePath("/payables");
  for (const supplierId of new Set((orders ?? []).map((o) => o.supplier_id))) {
    revalidatePath(`/suppliers/${supplierId}`);
  }

  if (failCount > 0) {
    return { error: `${ids.length - failCount}건 삭제, ${failCount}건 실패했습니다.` };
  }
  return { success: `${ids.length}건 삭제했습니다.` };
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

  const { data: order } = await supabase.from("purchase_orders").select("supplier_id").eq("id", id).maybeSingle();

  // 주문 삭제 + 재고 되돌리기를 DB 함수 하나로 묶어 원자적으로 처리한다.
  // 이전에는 두 단계를 개별 요청으로 보내서, 삭제는 성공했는데 그 다음
  // 재고 되돌리기가 실패하면 거래 기록은 사라졌지만 재고 수량은 틀어진
  // 채로 남는 문제가 있었다.
  const { error } = await supabase.rpc("delete_purchase_with_items", {
    p_id: id,
    p_deleted_by: user?.id ?? null,
  });

  if (error) {
    return { error: `삭제에 실패했습니다: ${error.message}` };
  }

  revalidatePath("/purchases");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  revalidatePath("/payables");
  if (order?.supplier_id) revalidatePath(`/suppliers/${order.supplier_id}`);
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

  if (!(await canManageOrder(supabase, "purchase_orders", purchaseOrderId))) {
    return { error: "본인이 등록한 매입 건에만 모조지 수량을 조정할 수 있습니다." };
  }

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

  if (!(await canManageOrder(supabase, "purchase_orders", purchaseOrderId))) {
    return { error: "본인이 등록한 매입 건에만 모조지 수량을 조정할 수 있습니다." };
  }

  const errorMessage = await revertPurchasePaperStockOverride(supabase, purchaseOrderId);
  if (errorMessage) return { error: errorMessage };

  revalidatePath(`/purchases/${purchaseOrderId}`);
  return { success: "자동 계산값으로 되돌렸습니다." };
}
