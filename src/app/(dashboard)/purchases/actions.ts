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

export async function createPurchase(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const supplierId = String(formData.get("supplier_id") ?? "");
  const warehouseId = String(formData.get("warehouse_id") ?? "");
  const purchaseDate = String(formData.get("purchase_date") ?? "");
  const memo = String(formData.get("memo") ?? "") || null;
  const itemsRaw = String(formData.get("items") ?? "[]");

  if (!supplierId || !warehouseId || !purchaseDate) {
    return { error: "공급업체, 창고, 매입일자를 모두 입력해주세요." };
  }

  let items: PurchaseItemInput[];
  try {
    items = JSON.parse(itemsRaw);
  } catch {
    return { error: "품목 정보를 처리하지 못했습니다." };
  }

  items = items.filter((item) => item.productId && item.quantity > 0);
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
