"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createWarehouse(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const supabase = await createClient();
  await supabase.from("warehouses").insert({
    name,
    location: String(formData.get("location") ?? "") || null,
  });

  revalidatePath("/warehouses");
}
