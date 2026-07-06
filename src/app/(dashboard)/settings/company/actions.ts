"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/components/form-message";

export async function updateCompanyProfile(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return { error: "상호명을 입력해주세요." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("company_profile")
    .update({
      name,
      business_number: String(formData.get("business_number") ?? "") || null,
      representative_name: String(formData.get("representative_name") ?? "") || null,
      address: String(formData.get("address") ?? "") || null,
      business_type: String(formData.get("business_type") ?? "") || null,
      business_item: String(formData.get("business_item") ?? "") || null,
      phone: String(formData.get("phone") ?? "") || null,
      fax_number: String(formData.get("fax_number") ?? "") || null,
      manager_name: String(formData.get("manager_name") ?? "") || null,
      manager_phone: String(formData.get("manager_phone") ?? "") || null,
      email: String(formData.get("email") ?? "") || null,
      greeting_message: String(formData.get("greeting_message") ?? "") || null,
    })
    .eq("id", 1);

  if (error) {
    return { error: "저장에 실패했습니다." };
  }

  revalidatePath("/settings/company");
  return { success: "회사 정보가 저장되었습니다." };
}

const BRANDING_SLOTS = {
  logo_wordmark_url: "logo-wordmark",
  logo_mark_url: "logo-mark",
  seal_image_url: "company-seal",
} as const;

type BrandingSlot = keyof typeof BRANDING_SLOTS;

export async function uploadBrandingImage(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const slot = String(formData.get("slot") ?? "") as BrandingSlot;
  const file = formData.get("file");

  if (!(slot in BRANDING_SLOTS)) {
    return { error: "잘못된 요청입니다." };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { error: "이미지 파일을 선택해주세요." };
  }
  if (!file.type.startsWith("image/")) {
    return { error: "이미지 파일만 업로드할 수 있습니다." };
  }

  const supabase = await createClient();
  const path = `${BRANDING_SLOTS[slot]}.png`;

  const { error: uploadError } = await supabase.storage
    .from("branding")
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) {
    return { error: "이미지 업로드에 실패했습니다." };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("branding").getPublicUrl(path);
  const url = `${publicUrl}?t=${Date.now()}`;

  const update =
    slot === "logo_wordmark_url"
      ? { logo_wordmark_url: url }
      : slot === "logo_mark_url"
        ? { logo_mark_url: url }
        : { seal_image_url: url };

  const { error } = await supabase.from("company_profile").update(update).eq("id", 1);

  if (error) {
    return { error: "저장에 실패했습니다." };
  }

  revalidatePath("/", "layout");
  return { success: "이미지가 저장되었습니다." };
}
