"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { canManageOrder } from "@/lib/can-manage-order";
import type { FormState } from "@/components/form-message";
import {
  overridePurchasePaperStockQuantity,
  overrideSalesPaperStockQuantity,
  revertPurchasePaperStockOverride,
  revertSalesPaperStockOverride,
  type PendingCalc,
} from "@/modules/paper-calc/lib/paper-calc-sync";

// "입고 불러오기"/"할일 가져오기"에서 모조지(TG0) 품목을 고르면, 수량만 옮기는
// 게 아니라 그 매입 건/할일에 저장돼 있던 모조지 계산(사이즈별 배치 내역) 자체를
// 가져와 새 매입/매출 건에도 그대로 붙일 수 있게 한다.
type CalculationRow = {
  paper_w: number;
  paper_h: number;
  input_items: PendingCalc["inputItems"];
  layouts: PendingCalc["layouts"];
  total_paper: number;
  total_sheet: number;
  total_prod: number;
  over_prod: number;
  fulfilled: boolean;
};

function toPendingCalc(calc: CalculationRow): PendingCalc {
  return {
    paperW: calc.paper_w,
    paperH: calc.paper_h,
    inputItems: calc.input_items,
    layouts: calc.layouts,
    totalPaper: calc.total_paper,
    totalSheet: calc.total_sheet,
    totalProd: calc.total_prod,
    overProd: calc.over_prod,
    fulfilled: calc.fulfilled,
  };
}

export async function getPaperCalculationsForPurchaseOrder(purchaseOrderId: string): Promise<PendingCalc[]> {
  if (!purchaseOrderId) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("paper_calculations")
    .select("paper_w, paper_h, input_items, layouts, total_paper, total_sheet, total_prod, over_prod, fulfilled")
    .eq("purchase_order_id", purchaseOrderId);

  return (data ?? []).map(toPendingCalc);
}

export async function getPaperCalculationsForTodo(todoId: string): Promise<PendingCalc[]> {
  if (!todoId) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("paper_calculations")
    .select("paper_w, paper_h, input_items, layouts, total_paper, total_sheet, total_prod, over_prod, fulfilled")
    .eq("todo_id", todoId);

  return (data ?? []).map(toPendingCalc);
}

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

  if (!(await canManageOrder(supabase, "sales_orders", salesOrderId))) {
    return { error: "본인이 등록한 매출 건에만 모조지 수량을 조정할 수 있습니다." };
  }

  const errorMessage = await overrideSalesPaperStockQuantity(
    supabase,
    salesOrderId,
    overrideQuantity,
    note
  );
  if (errorMessage) return { error: errorMessage };

  revalidatePath(`/sales/${salesOrderId}`);
  // overrideSalesPaperStockQuantity가 inventory_transactions를 insert해서
  // 실제 재고 수량을 바꾼다 — 다른 재고 변경 액션들과 마찬가지로 재고
  // 현황·대시보드도 갱신해야 한다.
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  return { success: "모조지 수량을 수동값으로 변경했습니다." };
}

export async function revertSalesPaperStock(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const salesOrderId = String(formData.get("sales_order_id") ?? "");
  if (!salesOrderId) return { error: "잘못된 요청입니다." };

  const supabase = await createClient();

  if (!(await canManageOrder(supabase, "sales_orders", salesOrderId))) {
    return { error: "본인이 등록한 매출 건에만 모조지 수량을 조정할 수 있습니다." };
  }

  const errorMessage = await revertSalesPaperStockOverride(supabase, salesOrderId);
  if (errorMessage) return { error: errorMessage };

  revalidatePath(`/sales/${salesOrderId}`);
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  return { success: "자동 계산값으로 되돌렸습니다." };
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
  // overridePurchasePaperStockQuantity가 inventory_transactions를 insert해서
  // 실제 재고 수량을 바꾼다 — 다른 재고 변경 액션들과 마찬가지로 재고
  // 현황·대시보드도 갱신해야 한다.
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
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
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  return { success: "자동 계산값으로 되돌렸습니다." };
}
