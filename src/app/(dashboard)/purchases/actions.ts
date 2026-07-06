"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type PurchaseItemInput = {
  productId: string;
  quantity: number;
  unitCost: number;
};

export async function createPurchase(formData: FormData) {
  const supplierId = String(formData.get("supplier_id") ?? "");
  const warehouseId = String(formData.get("warehouse_id") ?? "");
  const purchaseDate = String(formData.get("purchase_date") ?? "");
  const memo = String(formData.get("memo") ?? "") || null;
  const itemsRaw = String(formData.get("items") ?? "[]");

  if (!supplierId || !warehouseId || !purchaseDate) return;

  let items: PurchaseItemInput[];
  try {
    items = JSON.parse(itemsRaw);
  } catch {
    return;
  }

  items = items.filter((item) => item.productId && item.quantity > 0);
  if (items.length === 0) return;

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

  if (error || !purchaseOrder) return;

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
