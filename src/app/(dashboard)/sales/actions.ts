"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/components/form-message";

type SaleItemInput = {
  productId: string;
  spec?: string | null;
  quantity: number;
  unitPrice: number;
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

function isStockCheckViolation(message: string, code?: string) {
  return code === "23514" || message.includes("check constraint");
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

  if (!customerId || !warehouseId || !orderDate) {
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

  const { data: salesOrder, error } = await supabase
    .from("sales_orders")
    .insert({
      customer_id: customerId,
      warehouse_id: warehouseId,
      order_date: orderDate,
      memo,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error || !salesOrder) {
    return { error: "판매 거래 등록에 실패했습니다." };
  }

  const salesOrderId = salesOrder.id;

  const { error: itemsError } = await supabase.from("sales_order_items").insert(
    items.map((item) => ({
      sales_order_id: salesOrderId,
      product_id: item.productId,
      spec: item.spec || null,
      quantity: item.quantity,
      unit_price: item.unitPrice,
    }))
  );

  if (itemsError) {
    await supabase.from("sales_orders").delete().eq("id", salesOrderId);
    return { error: `품목 등록에 실패하여 거래 등록을 취소했습니다: ${itemsError.message}` };
  }

  // 재고 반영(출고)이 실패하면 거래 자체를 취소한다 — 그렇지 않으면 매출은
  // 등록됐는데 재고는 그대로인 상태(재고 차감 누락)가 조용히 남는다.
  const { error: invError } = await supabase.from("inventory_transactions").insert(
    items.map((item) => ({
      product_id: item.productId,
      warehouse_id: warehouseId,
      type: "out" as const,
      quantity: item.quantity,
      reference: `sales_order:${salesOrderId}`,
      sales_order_id: salesOrderId,
      created_by: user?.id ?? null,
    }))
  );

  if (invError) {
    await supabase.from("sales_order_items").delete().eq("sales_order_id", salesOrderId);
    await supabase.from("sales_orders").delete().eq("id", salesOrderId);
    return {
      error: isStockCheckViolation(invError.message, invError.code)
        ? "재고가 부족하여 출고할 수 없습니다. 현재 재고를 확인한 뒤 다시 시도해주세요."
        : `재고 반영에 실패하여 거래 등록을 취소했습니다: ${invError.message}`,
    };
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
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  redirect(`/sales/${salesOrderId}/print`);
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
    return {
      error: isStockCheckViolation(invError.message, invError.code)
        ? "재고가 부족하여 출고할 수 없습니다. 현재 재고를 확인한 뒤 다시 시도해주세요."
        : `재고 반영에 실패했습니다: ${invError.message}`,
    };
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
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  redirect(`/sales/${id}/print`);
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
