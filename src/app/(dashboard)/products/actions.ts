"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createProduct(formData: FormData) {
  const sku = String(formData.get("sku") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!sku || !name) return;

  const categoryId = String(formData.get("category_id") ?? "") || null;
  const supplierId = String(formData.get("supplier_id") ?? "") || null;

  const supabase = await createClient();
  await supabase.from("products").insert({
    sku,
    name,
    category_id: categoryId,
    supplier_id: supplierId,
    unit: String(formData.get("unit") ?? "ea") || "ea",
    price: Number(formData.get("price") ?? 0),
    cost: Number(formData.get("cost") ?? 0),
    reorder_point: Number(formData.get("reorder_point") ?? 0),
  });

  revalidatePath("/products");
}
