"use server";

import { revalidatePath } from "next/cache";
import { combinePhone } from "@/lib/phone";
import { detectRasterImageType } from "@/lib/upload-safety";
import { requireAdmin } from "@/lib/require-admin";
import type { FormState } from "@/components/form-message";

export async function updateCompanyProfile(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const { supabase, isAdmin } = await requireAdmin();
  if (!isAdmin) return { error: "관리자만 회사 정보를 수정할 수 있습니다." };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return { error: "상호명을 입력해주세요." };
  }

  const { error } = await supabase
    .from("company_profile")
    .update({
      name,
      business_number: String(formData.get("business_number") ?? "") || null,
      representative_name: String(formData.get("representative_name") ?? "") || null,
      address: String(formData.get("address") ?? "") || null,
      business_type: String(formData.get("business_type") ?? "") || null,
      business_item: String(formData.get("business_item") ?? "") || null,
      phone: combinePhone(formData, "phone"),
      fax_number: combinePhone(formData, "fax"),
      manager_name: String(formData.get("manager_name") ?? "") || null,
      manager_phone: combinePhone(formData, "mgrphone"),
      email: String(formData.get("email") ?? "") || null,
      greeting_message: String(formData.get("greeting_message") ?? "") || null,
    })
    .eq("id", 1);

  if (error) {
    return {
      error: error.message.includes("column")
        ? "저장에 실패했습니다. 아직 실행하지 않은 데이터베이스 마이그레이션이 있을 수 있습니다."
        : "저장에 실패했습니다.",
    };
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
  const { supabase, isAdmin } = await requireAdmin();
  if (!isAdmin) return { error: "관리자만 이미지를 변경할 수 있습니다." };

  const slot = String(formData.get("slot") ?? "") as BrandingSlot;
  const file = formData.get("file");

  if (!(slot in BRANDING_SLOTS)) {
    return { error: "잘못된 요청입니다." };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { error: "이미지 파일을 선택해주세요." };
  }
  // file.type은 클라이언트가 주장하는 값일 뿐이라(예: svg에 image/png를 붙여
  // 보낼 수도 있음) 그대로 믿지 않고, 실제 파일 바이트(매직 넘버)로 진짜
  // 래스터 이미지인지 확인한다. 로고/도장은 항상 <img>로 그대로 렌더링되므로
  // svg/html처럼 브라우저가 실행 가능한 형식이 섞여 들어오면 안 된다.
  const detectedType = await detectRasterImageType(file);
  if (!detectedType) {
    return { error: "PNG, JPG, GIF, WEBP 형식의 이미지 파일만 업로드할 수 있습니다." };
  }

  const path = `${BRANDING_SLOTS[slot]}.png`;

  const { error: uploadError } = await supabase.storage
    .from("branding")
    .upload(path, file, { upsert: true, contentType: detectedType });

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
