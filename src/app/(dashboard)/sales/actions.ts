"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  attachCopiedPaperCalculations,
  attachPendingPaperCalculation,
  overrideSalesPaperStockQuantity,
  revertSalesPaperStockOverride,
} from "@/lib/paper-calc-sync";
import { markTodoSideDone } from "@/lib/todo-flow";
import type { FormState } from "@/components/form-message";

type SaleItemInput = {
  productId: string;
  spec?: string | null;
  quantity: number;
  unitPrice: number;
  remark?: string | null;
};

function parseItems(itemsRaw: string): SaleItemInput[] | null {
  try {
    const items = JSON.parse(itemsRaw) as SaleItemInput[];
    return items.filter((item) => item.productId && item.quantity > 0);
  } catch {
    return null;
  }
}

export async function createSale(_prevState: FormState, formData: FormData): Promise<FormState> {
  const customerId = String(formData.get("customer_id") ?? "");
  const warehouseId = String(formData.get("warehouse_id") ?? "");
  const orderDate = String(formData.get("order_date") ?? "");
  const memo = String(formData.get("memo") ?? "") || null;
  // "항상 외상" 체크박스가 켜져 있으면(기본값) 폼에서 이 필드를 아예 안
  // 보내서 null(외상)로 저장된다 — 체크를 끄고 결제방법을 고른 경우에만 값이 온다.
  const paymentMethod = String(formData.get("payment_method") ?? "") || null;
  const items = parseItems(String(formData.get("items") ?? "[]"));
  // 모조지 계산을 미리 연결해둔 경우, 그 계산이 만들 TG0 품목 한 줄로도
  // 충분하므로 여기서는 수동 품목이 0개여도 등록을 막지 않는다.
  const pendingPaperCalc = String(formData.get("pendingPaperCalc") ?? "");
  // 입고 불러오기로 가져온 모조지 계산(사이즈별 배치 내역, 여러 건일 수 있음).
  const copiedPaperCalcs = String(formData.get("copiedPaperCalcs") ?? "");
  // 할일 가져오기로 채운 할일 id들 — 등록이 실제로 성공하면 해당 할일의
  // 매출 방향을 완료 처리한다(유형에 따라 할일 자체가 완료될 수도 있음).
  const importedTodoIdsRaw = String(formData.get("importedTodoIds") ?? "");
  // 등록 화면에서 TG0 자동 반영 수량을 직접 고친 경우(거래처 협의 등)에만
  // 값이 들어온다 — 있으면 주문 생성 직후 오버라이드 이력을 남긴다.
  const tg0OverrideRaw = String(formData.get("tg0OverrideQuantity") ?? "");

  if (!customerId || !warehouseId || !orderDate) {
    return { error: "출고처, 창고, 거래일자를 모두 입력해주세요." };
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
    p_payment_method: paymentMethod,
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
  // 방금 만든 주문에 붙여서 저장하고 TG0 판매 품목에도 반영한다. 이 단계가
  // 실패해도 주문 자체는 이미 생성됐으니 등록을 막지 않되, 조용히 묻히지
  // 않도록 상세 화면으로 경고 메시지를 실어 보낸다.
  let paperCalcWarning: string | null = null;
  if (pendingPaperCalc) {
    paperCalcWarning = await attachPendingPaperCalculation(supabase, salesOrderId, pendingPaperCalc);
  }

  // 입고 불러오기로 가져온 모조지 계산(들)이 있으면 같은 방식으로 붙인다.
  if (copiedPaperCalcs) {
    paperCalcWarning ??= await attachCopiedPaperCalculations(supabase, salesOrderId, copiedPaperCalcs);
  }

  // TG0 자동 반영 줄이 위에서 이미 만들어진 뒤에만 오버라이드를 적용할 수
  // 있으므로 반드시 attachPendingPaperCalculation(들) 다음에 호출한다.
  const tg0OverrideQuantity = Number(tg0OverrideRaw);
  if (tg0OverrideRaw && Number.isFinite(tg0OverrideQuantity) && tg0OverrideQuantity > 0) {
    await overrideSalesPaperStockQuantity(supabase, salesOrderId, tg0OverrideQuantity, "등록 시 직접 입력");
  }

  // 할일 가져오기로 채웠던 할일들의 매출 방향을 완료 처리한다. 등록이 실제로
  // 성공한 이 시점에만 찍는다 — 가져오기만 하고 등록을 취소하면 남아있어야 한다.
  if (importedTodoIdsRaw) {
    try {
      const todoIds = JSON.parse(importedTodoIdsRaw);
      if (Array.isArray(todoIds)) {
        for (const todoId of todoIds) {
          if (typeof todoId === "string" && todoId) {
            await markTodoSideDone(supabase, todoId, "sale");
          }
        }
      }
    } catch {
      // 무시: 할일 완료 처리는 부가 동작이라 등록 자체를 막지 않는다.
    }
    revalidatePath("/todos");
  }

  revalidatePath("/sales");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  revalidatePath("/paper-calc");
  revalidatePath("/receivables");
  revalidatePath(`/customers/${customerId}`);
  redirect(
    paperCalcWarning
      ? `/sales/${salesOrderId}?warning=${encodeURIComponent(paperCalcWarning)}`
      : `/sales/${salesOrderId}`
  );
}

export async function updateSale(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  const customerId = String(formData.get("customer_id") ?? "");
  const warehouseId = String(formData.get("warehouse_id") ?? "");
  const orderDate = String(formData.get("order_date") ?? "");
  const memo = String(formData.get("memo") ?? "") || null;
  const paymentMethod = String(formData.get("payment_method") ?? "") || null;
  const items = parseItems(String(formData.get("items") ?? "[]"));

  if (!id || !customerId || !warehouseId || !orderDate) {
    return { error: "출고처, 창고, 거래일자를 모두 입력해주세요." };
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
  // 하나로 묶어 원자적으로 처리한다 — createSale과 같은 이유로, 이전에는
  // 이 단계들을 개별 요청으로 보내서 중간(특히 "새 품목 삽입")에 실패하면
  // 헤더/재고는 이미 바뀌었는데 품목이 0개로 남는 불일치가 생길 수 있었다.
  const { error } = await supabase.rpc("update_sale_with_items", {
    p_id: id,
    p_customer_id: customerId,
    p_warehouse_id: warehouseId,
    p_order_date: orderDate,
    p_memo: memo,
    p_updated_by: user?.id ?? null,
    p_items: items.map((item) => ({
      productId: item.productId,
      spec: item.spec || null,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      remark: item.remark || null,
    })),
    p_payment_method: paymentMethod,
  });

  if (error) {
    return { error: `매출 거래 수정에 실패했습니다: ${error.message}` };
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
  revalidatePath("/receivables");
  revalidatePath(`/customers/${customerId}`);
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

  // 주문 삭제 + 재고 되돌리기를 DB 함수 하나로 묶어 원자적으로 처리한다.
  // 이전에는 두 단계를 개별 요청으로 보내서, 삭제는 성공했는데 그 다음
  // 재고 되돌리기가 실패하면 거래 기록은 사라졌지만 재고 수량은 틀어진
  // 채로 남는 문제가 있었다.
  const { error } = await supabase.rpc("delete_sale_with_items", {
    p_id: id,
    p_deleted_by: user?.id ?? null,
  });

  if (error) {
    return { error: `삭제에 실패했습니다: ${error.message}` };
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
