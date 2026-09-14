"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/components/form-message";

// 생산지시 등록 — create_work_order() RPC(migration 100) 하나로 등록+
// 구성품 소모(출고)+완제품 입고를 원자적으로 처리한다. create_sale_with_items
// 등과 같은 이유(재고 반영까지 한 번에 묶어야 중간에 실패해도 고아 데이터가
// 안 남는다)로 RPC를 쓴다.
export async function createWorkOrder(_prevState: FormState, formData: FormData): Promise<FormState> {
  const productId = String(formData.get("product_id") ?? "");
  const warehouseId = String(formData.get("warehouse_id") ?? "");
  const quantity = Number(formData.get("quantity") ?? 0);
  const orderDate = String(formData.get("order_date") ?? "");
  const memo = String(formData.get("memo") ?? "").trim() || null;

  if (!productId || !warehouseId || !orderDate) {
    return { error: "완제품, 창고, 지시일자를 모두 입력해주세요." };
  }
  if (!(quantity > 0)) {
    return { error: "생산 수량은 0보다 커야 합니다." };
  }

  const supabase = await createClient();
  const { data: workOrderId, error } = await supabase.rpc("create_work_order", {
    p_product_id: productId,
    p_warehouse_id: warehouseId,
    p_quantity: quantity,
    p_order_date: orderDate,
    p_memo: memo,
  });

  if (error || !workOrderId) {
    return { error: `생산지시 등록에 실패했습니다: ${error?.message ?? "알 수 없는 오류"}` };
  }

  revalidatePath("/production");
  revalidatePath("/inventory");
  redirect("/production");
}

export async function deleteWorkOrder(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "잘못된 요청입니다." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_work_order", { p_id: id });
  if (error) {
    return { error: `삭제에 실패했습니다: ${error.message}` };
  }

  revalidatePath("/production");
  revalidatePath("/inventory");
  return { success: "생산지시를 삭제했습니다." };
}
