"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUser } from "@/lib/supabase/server";
import type { FormState } from "@/components/form-message";

export async function approveCustomerOrder(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "잘못된 요청입니다." };

  const supabase = await createClient();
  const user = await getUser();
  const { error } = await supabase
    .from("customer_orders")
    .update({ status: "approved", reviewed_by: user?.id ?? null, reviewed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "requested");

  if (error) return { error: `승인 처리에 실패했습니다: ${error.message}` };

  revalidatePath("/customer-orders");
  return { success: "승인했습니다. 필요하면 아래에서 생산지시로 전환하세요." };
}

export async function rejectCustomerOrder(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  const reason = String(formData.get("reject_reason") ?? "").trim();
  if (!id) return { error: "잘못된 요청입니다." };
  if (!reason) return { error: "반려 사유를 입력해주세요." };

  const supabase = await createClient();
  const user = await getUser();
  const { error } = await supabase
    .from("customer_orders")
    .update({
      status: "rejected",
      reject_reason: reason,
      reviewed_by: user?.id ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "requested");

  if (error) return { error: `반려 처리에 실패했습니다: ${error.message}` };

  revalidatePath("/customer-orders");
  return { success: "반려했습니다." };
}

// 주문 품목 중 하나를 골라 생산지시로 전환한다(기존 create_work_order()
// RPC를 그대로 재사용 — 생산관리에서 수동으로 등록하는 것과 완전히
// 같은 경로다). 거래처 주문 1건에 여러 품목이 섞여 있으면 품목별로
// 각각 눌러야 하는데, 지금은 거의 단일 품목 주문이라 이 정도로도 충분하고
// 앞으로 품목이 여러 개인 주문이 흔해지면 일괄 전환을 추가하면 된다.
export async function convertCustomerOrderItemToWorkOrder(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const orderId = String(formData.get("order_id") ?? "");
  const productId = String(formData.get("product_id") ?? "");
  const quantity = Number(formData.get("quantity") ?? 0);
  const warehouseId = String(formData.get("warehouse_id") ?? "");
  const orderDate = String(formData.get("order_date") ?? "");

  if (!orderId || !productId || !warehouseId || !orderDate || !(quantity > 0)) {
    return { error: "창고와 지시일자를 확인해주세요." };
  }

  const supabase = await createClient();
  const { data: workOrderId, error } = await supabase.rpc("create_work_order", {
    p_product_id: productId,
    p_warehouse_id: warehouseId,
    p_quantity: quantity,
    p_order_date: orderDate,
    p_memo: `거래처 포털 주문 전환`,
  });

  if (error || !workOrderId) {
    return { error: `생산지시 생성에 실패했습니다: ${error?.message ?? "알 수 없는 오류"}` };
  }

  const { error: linkError } = await supabase
    .from("customer_orders")
    .update({ work_order_id: workOrderId })
    .eq("id", orderId);
  if (linkError) return { error: `생산지시는 만들어졌지만 주문과 연결에 실패했습니다: ${linkError.message}` };

  revalidatePath("/customer-orders");
  revalidatePath("/production");
  return { success: "생산지시로 전환했습니다." };
}

// 주문 품목이 BOM 없는(= 우리가 만드는 게 아니라 사입해서 그대로 파는)
// 품목이면 생산지시가 아니라 바로 판매로 넘겨야 한다. "매출관리 > 출고관리"에서
// 수동 등록할 때와 같은 create_sale_with_items() RPC를 그대로 재사용한다 —
// 거래처 포털 주문 전환이라는 출처만 다르고 재고 반영 등은 완전히 동일한
// 경로다.
export async function convertCustomerOrderItemToSale(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const orderId = String(formData.get("order_id") ?? "");
  const customerId = String(formData.get("customer_id") ?? "");
  const productId = String(formData.get("product_id") ?? "");
  const quantity = Number(formData.get("quantity") ?? 0);
  const unitPrice = Number(formData.get("unit_price") ?? 0);
  const warehouseId = String(formData.get("warehouse_id") ?? "");
  const orderDate = String(formData.get("order_date") ?? "");

  if (!orderId || !customerId || !productId || !warehouseId || !orderDate || !(quantity > 0)) {
    return { error: "창고와 거래일자를 확인해주세요." };
  }

  const supabase = await createClient();
  const user = await getUser();
  const { data: salesOrderId, error } = await supabase.rpc("create_sale_with_items", {
    p_customer_id: customerId,
    p_warehouse_id: warehouseId,
    p_order_date: orderDate,
    p_memo: "거래처 포털 주문 전환",
    p_created_by: user?.id ?? null,
    p_items: [{ productId, quantity, unitPrice, remark: null }],
  });

  if (error || !salesOrderId) {
    return { error: `판매 등록에 실패했습니다: ${error?.message ?? "알 수 없는 오류"}` };
  }

  const { error: linkError } = await supabase
    .from("customer_orders")
    .update({ sales_order_id: salesOrderId })
    .eq("id", orderId);
  if (linkError) return { error: `판매는 등록됐지만 주문과 연결에 실패했습니다: ${linkError.message}` };

  revalidatePath("/customer-orders");
  revalidatePath("/sales");
  return { success: "판매로 전환했습니다." };
}

export async function updateCustomerOrderShipping(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  const shippingStatus = String(formData.get("shipping_status") ?? "");
  if (!id || !["shipped", "delivered"].includes(shippingStatus)) {
    return { error: "잘못된 요청입니다." };
  }

  const supabase = await createClient();
  const now = new Date().toISOString();
  const { error } =
    shippingStatus === "shipped"
      ? await supabase.from("customer_orders").update({ shipping_status: "shipped", shipped_at: now }).eq("id", id)
      : await supabase
          .from("customer_orders")
          .update({ shipping_status: "delivered", delivered_at: now })
          .eq("id", id);
  if (error) return { error: `배송 상태 변경에 실패했습니다: ${error.message}` };

  revalidatePath("/customer-orders");
  return { success: "배송 상태를 변경했습니다." };
}
