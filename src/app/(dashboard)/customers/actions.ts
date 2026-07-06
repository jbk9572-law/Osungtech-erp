"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createCustomer(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const supabase = await createClient();
  await supabase.from("customers").insert({
    name,
    business_number: String(formData.get("business_number") ?? "") || null,
    representative_name: String(formData.get("representative_name") ?? "") || null,
    contact_name: String(formData.get("contact_name") ?? "") || null,
    email: String(formData.get("email") ?? "") || null,
    phone: String(formData.get("phone") ?? "") || null,
    address: String(formData.get("address") ?? "") || null,
  });

  revalidatePath("/customers");
}

export async function upsertCustomerPrice(formData: FormData) {
  const customerId = String(formData.get("customer_id") ?? "");
  const productId = String(formData.get("product_id") ?? "");
  const unitPrice = Number(formData.get("unit_price") ?? 0);
  if (!customerId || !productId) return;

  const supabase = await createClient();
  await supabase
    .from("customer_product_prices")
    .upsert(
      { customer_id: customerId, product_id: productId, unit_price: unitPrice },
      { onConflict: "customer_id,product_id" }
    );

  revalidatePath(`/customers/${customerId}`);
}
