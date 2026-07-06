"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/components/form-message";

type PurchaseItemInput = {
  productId: string;
  quantity: number;
  unitCost: number;
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

// 기존 매입 건의 입고 효과를 재고 조정(adjustment)으로 되돌린다.
// 호출 전에 미리 읽어둔 품목/창고 정보를 받는다 (주문을 지우거나 바꾸고 나면
// 원래 품목 수량을 알 수 없기 때문에, 실제 삭제/수정이 성공한 뒤에만 호출해야 한다).
async function reversePurchaseInventory(
  supabase: SupabaseServerClient,
  purchaseOrderId: string,
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
      quantity: -item.quantity,
      reference: `purchase_order_reversal:${purchaseOrderId}`,
      created_by: userId,
    }))
  );
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

  await supabase.from("purchase_order_items").insert(
    items.map((item) => ({
      purchase_order_id: purchaseOrderId,
      product_id: item.productId,
      quantity: item.quantity,
      unit_cost: item.unitCost,
    }))
  );

  await supabase.from("inventory_transactions").insert(
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

  await Promise.all(
    items.map((item) =>
      supabase.from("products").update({ cost: item.unitCost }).eq("id", item.productId)
    )
  );

  revalidatePath("/purchases");
  revalidatePath("/inventory");
  revalidatePath("/products");
  revalidatePath("/dashboard");
  redirect(`/purchases`);
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

  await reversePurchaseInventory(supabase, id, oldOrder.warehouse_id, oldItems ?? [], user?.id ?? null);
  await supabase.from("purchase_order_items").delete().eq("purchase_order_id", id);

  await supabase.from("purchase_order_items").insert(
    items.map((item) => ({
      purchase_order_id: id,
      product_id: item.productId,
      quantity: item.quantity,
      unit_cost: item.unitCost,
    }))
  );

  await supabase.from("inventory_transactions").insert(
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

  await reversePurchaseInventory(supabase, id, order.warehouse_id, items ?? [], user?.id ?? null);

  revalidatePath("/purchases");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  redirect("/purchases");
}
