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
    });
  // id로 안 고른다 — RLS가 실제 계정은 진짜 회사정보 행만, 데모 계정은
  // 데모용 행만 갱신되게 걸러준다(company_profile_demo_isolation
  // 마이그레이션 참고). id=1로 고정했다가 데모 계정이 실제 회사정보를
  // 그대로 덮어쓰던 버그가 있었다.

  if (error) {
    return {
      error: error.message.includes("column")
        ? "저장에 실패했습니다. 아직 실행하지 않은 데이터베이스 마이그레이션이 있을 수 있습니다."
        : `저장에 실패했습니다: ${error.message}`,
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

  // 스토리지 버킷 경로는 DB 행과 달리 RLS로 자동 분리되지 않는다 —
  // 데모 계정과 실제 계정이 같은 파일 경로("logo-wordmark.png")에 그대로
  // 업로드하면 서로의 로고를 덮어써버린다. 데모 계정이면 "demo/" 폴더
  // 아래에 따로 저장한다. 이 판정이 실패하면 데모 계정이 실제 경로로
  // 잘못 새는 걸 막기 위해, 조용히 넘어가지 않고 업로드 자체를 막는다.
  const { data: isDemo, error: isDemoError } = await supabase.rpc("is_demo_actor");
  if (isDemoError) {
    return { error: `계정 종류를 확인하지 못해 업로드를 중단했습니다: ${isDemoError.message}` };
  }
  const path = isDemo ? `demo/${BRANDING_SLOTS[slot]}.png` : `${BRANDING_SLOTS[slot]}.png`;

  const { error: uploadError } = await supabase.storage
    .from("branding")
    .upload(path, file, { upsert: true, contentType: detectedType });

  if (uploadError) {
    return { error: `이미지 업로드에 실패했습니다: ${uploadError.message}` };
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

  // id로 안 고른다 — RLS가 실제/데모 계정에 맞는 행만 갱신되게 걸러준다
  // (company_profile_demo_isolation 마이그레이션 참고).
  const { error } = await supabase.from("company_profile").update(update);

  if (error) {
    return { error: `저장에 실패했습니다: ${error.message}` };
  }

  revalidatePath("/", "layout");
  return { success: "이미지가 저장되었습니다." };
}
