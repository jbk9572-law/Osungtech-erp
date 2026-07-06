"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createTransaction(formData: FormData) {
  const productId = String(formData.get("product_id") ?? "");
  const warehouseId = String(formData.get("warehouse_id") ?? "");
  const type = String(formData.get("type") ?? "in") as "in" | "out" | "adjustment";
  const quantity = Number(formData.get("quantity") ?? 0);

  if (!productId || !warehouseId || !quantity) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase.from("inventory_transactions").insert({
    product_id: productId,
    warehouse_id: warehouseId,
    type,
    quantity,
    reference: String(formData.get("reference") ?? "") || null,
    note: String(formData.get("note") ?? "") || null,
    created_by: user?.id ?? null,
  });

  revalidatePath("/transactions");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
}
