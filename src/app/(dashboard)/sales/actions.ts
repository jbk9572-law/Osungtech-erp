"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/components/form-message";

type SaleItemInput = {
  productId: string;
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

// 기존 판매 건의 출고 효과를 재고 조정(adjustment)으로 되돌린다.
// 호출 전에 미리 읽어둔 품목/창고 정보를 받는다 (주문을 지우거나 바꾸고 나면
// 원래 품목 수량을 알 수 없기 때문에, 실제 삭제/수정이 성공한 뒤에만 호출해야 한다).
async function reverseSaleInventory(
  supabase: SupabaseServerClient,
  salesOrderId: string,
  warehouseId: string,
  items: { product_id: string; quantity: number }[],
  userId: string | null
) {
  if (!items.length) return;

  await supabase.from("inventory_transactions").insert(
    items.map((item) => ({
      product_id: item.product_id,
      warehouse_id: warehouseId,
      type: "adjustment" as const,
      quantity: item.quantity,
      reference: `sales_order_reversal:${salesOrderId}`,
      created_by: userId,
    }))
  );
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

  await supabase.from("sales_order_items").insert(
    items.map((item) => ({
      sales_order_id: salesOrderId,
      product_id: item.productId,
      quantity: item.quantity,
      unit_price: item.unitPrice,
    }))
  );

  await supabase.from("inventory_transactions").insert(
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

  await reverseSaleInventory(supabase, id, oldOrder.warehouse_id, oldItems ?? [], user?.id ?? null);
  await supabase.from("sales_order_items").delete().eq("sales_order_id", id);

  await supabase.from("sales_order_items").insert(
    items.map((item) => ({
      sales_order_id: id,
      product_id: item.productId,
      quantity: item.quantity,
      unit_price: item.unitPrice,
    }))
  );

  await supabase.from("inventory_transactions").insert(
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

export async function updateSaleStatus(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !status) return;

  const supabase = await createClient();
  await supabase.from("sales_orders").update({ status }).eq("id", id);

  revalidatePath("/sales");
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

  await reverseSaleInventory(supabase, id, order.warehouse_id, items ?? [], user?.id ?? null);

  revalidatePath("/sales");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  redirect("/sales");
}
