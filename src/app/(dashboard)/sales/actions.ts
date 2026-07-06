"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type SaleItemInput = {
  productId: string;
  quantity: number;
  unitPrice: number;
};

export async function createSale(formData: FormData) {
  const customerId = String(formData.get("customer_id") ?? "");
  const warehouseId = String(formData.get("warehouse_id") ?? "");
  const orderDate = String(formData.get("order_date") ?? "");
  const memo = String(formData.get("memo") ?? "") || null;
  const itemsRaw = String(formData.get("items") ?? "[]");

  if (!customerId || !warehouseId || !orderDate) return;

  let items: SaleItemInput[];
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

  if (error || !salesOrder) return;

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
