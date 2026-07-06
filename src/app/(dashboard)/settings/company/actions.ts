"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateCompanyProfile(formData: FormData) {
  const supabase = await createClient();
  await supabase
    .from("company_profile")
    .update({
      name: String(formData.get("name") ?? "").trim(),
      business_number: String(formData.get("business_number") ?? "") || null,
      representative_name: String(formData.get("representative_name") ?? "") || null,
      address: String(formData.get("address") ?? "") || null,
      business_type: String(formData.get("business_type") ?? "") || null,
      business_item: String(formData.get("business_item") ?? "") || null,
      phone: String(formData.get("phone") ?? "") || null,
    })
    .eq("id", 1);

  revalidatePath("/settings/company");
}
