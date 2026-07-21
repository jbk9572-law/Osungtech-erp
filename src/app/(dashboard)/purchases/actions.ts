"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  attachPendingPaperCalculationToPurchase,
  overridePurchasePaperStockQuantity,
  revertPurchasePaperStockOverride,
} from "@/lib/paper-calc-sync";
import type { FormState } from "@/components/form-message";

type PurchaseItemInput = {
  productId: string;
  spec?: string | null;
  quantity: number;
  unitCost: number;
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

function isStockCheckViolation(message: string, code?: string) {
  return code === "23514" || message.includes("check constraint");
}

// 목록을 매입일자 기준으로 정렬하게 되면 "언제 수정됐는지"는 더 이상
// 정렬만 봐서는 알 수 없어서, 수정할 때마다 메모 끝에 수정 시각을 남긴다.
// 다시 수정하면 이전 수정 기록은 지우고 최신 것만 남긴다(누적되면
// 메모가 지저분해진다).
function withEditNote(memo: string | null): string {
  const note = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    hour12: false,
  })
    .formatToParts(new Date())
    .reduce((acc, part) => {
      if (part.type === "month") return `${acc}${part.value}월`;
      if (part.type === "day") return `${acc}${part.value}일`;
      if (part.type === "hour") return `${acc}${part.value}시`;
      return acc;
    }, "");
  // 메모 입력칸이 한 줄짜리 input이라 줄바꿈 대신 " · "로 구분한다.
  const base = (memo ?? "").replace(/\s*·?\s*\d{1,2}월\d{1,2}일\d{1,2}시 수정됨\s*$/, "").trim();
  return base ? `${base} · ${note} 수정됨` : `${note} 수정됨`;
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

  if (!supplierId || !warehouseId || !purchaseDate) {
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

  const { data: purchaseOrder, error } = await supabase
    .from("purchase_orders")
    .insert({
      supplier_id: supplierId,
      warehouse_id: warehouseId,
      purchase_date: purchaseDate,
      memo,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error || !purchaseOrder) {
    return { error: "매입 거래 등록에 실패했습니다." };
  }

  const purchaseOrderId = purchaseOrder.id;

  const { error: itemsError } = await supabase.from("purchase_order_items").insert(
    items.map((item) => ({
      purchase_order_id: purchaseOrderId,
      product_id: item.productId,
      spec: item.spec || null,
      quantity: item.quantity,
      unit_cost: item.unitCost,
      remark: item.remark || null,
    }))
  );

  if (itemsError) {
    await supabase.from("purchase_orders").delete().eq("id", purchaseOrderId);
    return { error: `품목 등록에 실패하여 거래 등록을 취소했습니다: ${itemsError.message}` };
  }

  // 재고 반영(입고)이 실패하면 거래 자체를 취소한다 — 그렇지 않으면 매입은
  // 등록됐는데 재고는 그대로인 상태(재고 반영 누락)가 조용히 남는다.
  const { error: invError } = await supabase.from("inventory_transactions").insert(
    items.map((item) => ({
      product_id: item.productId,
      warehouse_id: warehouseId,
      type: "in" as const,
      quantity: item.quantity,
      reference: `purchase_order:${purchaseOrderId}`,
      purchase_order_id: purchaseOrderId,
      created_by: user?.id ?? null,
    }))
  );

  if (invError) {
    await supabase.from("purchase_order_items").delete().eq("purchase_order_id", purchaseOrderId);
    await supabase.from("purchase_orders").delete().eq("id", purchaseOrderId);
    return {
      error: isStockCheckViolation(invError.message, invError.code)
        ? "재고 반영에 실패했습니다. 입력한 수량을 확인한 뒤 다시 시도해주세요."
        : `재고 반영에 실패하여 거래 등록을 취소했습니다: ${invError.message}`,
    };
  }

  await Promise.all(
    items.map((item) =>
      supabase.from("products").update({ cost: item.unitCost }).eq("id", item.productId)
    )
  );

  if (pendingPaperCalc) {
    await attachPendingPaperCalculationToPurchase(supabase, purchaseOrderId, pendingPaperCalc);
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
      memo: withEditNote(memo),
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
    return {
      error: isStockCheckViolation(reverseError)
        ? "기존 입고분을 되돌리는 중 재고가 부족해 수정을 중단했습니다. 해당 품목이 이미 출고되었는지 확인해주세요."
        : `기존 재고 반영을 되돌리지 못해 수정을 중단했습니다: ${reverseError}`,
    };
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
    return {
      error: isStockCheckViolation(invError.message, invError.code)
        ? "재고 반영에 실패했습니다. 입력한 수량을 확인한 뒤 다시 시도해주세요."
        : `재고 반영에 실패했습니다: ${invError.message}`,
    };
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
      error: isStockCheckViolation(reverseError)
        ? "거래는 삭제되었지만 재고 차감에 실패했습니다 (재고 부족). 재고 조정 화면에서 직접 확인해주세요."
        : `거래는 삭제되었지만 재고 반영에 실패했습니다: ${reverseError} — 재고 조정 화면에서 직접 확인해주세요.`,
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
