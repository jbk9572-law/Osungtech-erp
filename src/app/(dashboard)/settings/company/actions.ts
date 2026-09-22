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

  const officeLatRaw = String(formData.get("office_lat") ?? "").trim();
  const officeLngRaw = String(formData.get("office_lng") ?? "").trim();
  const officeRadiusRaw = String(formData.get("office_radius_m") ?? "").trim();
  const officeLat = officeLatRaw ? Number(officeLatRaw) : null;
  const officeLng = officeLngRaw ? Number(officeLngRaw) : null;
  const officeRadiusM = officeRadiusRaw ? Number(officeRadiusRaw) : 300;
  if ((officeLat != null && !Number.isFinite(officeLat)) || (officeLng != null && !Number.isFinite(officeLng))) {
    return { error: "사무실 위치 좌표를 올바르게 입력해주세요." };
  }
  if (!Number.isFinite(officeRadiusM) || officeRadiusM <= 0) {
    return { error: "사무실 인정 반경을 올바르게 입력해주세요." };
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
      office_lat: officeLat,
      office_lng: officeLng,
      office_radius_m: officeRadiusM,
    })
    // id 값으로 특정 행을 고르는 게 아니라(RLS가 실제/데모 계정에 맞는
    // 행만 갱신되게 걸러준다 — company_profile_demo_isolation 마이그레이션
    // 참고), DB가 WHERE절 없는 UPDATE 자체를 막고 있어서 형식상 항상
    // 참인 조건을 하나 붙여준다.
    .not("id", "is", null);

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
  // (company_profile_demo_isolation 마이그레이션 참고). DB가 WHERE절
  // 없는 UPDATE를 막고 있어서 형식상 항상 참인 조건을 붙여준다.
  const { error } = await supabase.from("company_profile").update(update).not("id", "is", null);

  if (error) {
    return { error: `저장에 실패했습니다: ${error.message}` };
  }

  revalidatePath("/", "layout");
  return { success: "이미지가 저장되었습니다." };
}

// 데모 계정용 대체 이미지 — public/branding/logo-*.png(실제 회사 로고·도장)를
// 그대로 fallback으로 쓰면 데모 계정이 지워도 실제 이미지가 다시 보이게
// 된다. 데모 계정이 "기본값으로" 버튼을 누르면 null이 아니라 이 샘플
// 이미지로 되돌린다.
const DEMO_DEFAULT_URLS: Record<BrandingSlot, string> = {
  logo_wordmark_url: "/branding/sample-logo-wordmark.png",
  logo_mark_url: "/branding/sample-logo-mark.png",
  seal_image_url: "/branding/sample-company-seal.png",
};

// 업로드한 로고/도장을 기본값으로 되돌린다. 실제 계정은 null로 되돌리는데,
// 로고는 null이면 ELVONIX 기본 로고(레포에 커밋된 이미지, 브랜드 공용
// 자산이라 아무 회사가 봐도 무방함)가 보이지만, 도장은 다르다 — null이면
// 반드시 "샘플" 플레이스홀더(sample-company-seal.png)가 보여야 한다.
// 예전엔 도장 기본값이 오성테크의 실제 법인 인감 이미지였는데, 도장을
// 안 올린 다른 회사 화면(실제 거래명세표/세금계산서 포함)에 오성테크의
// 진짜 인감이 그대로 노출되는 심각한 문제가 있었다. 데모 계정은 null이
// 아니라 위 샘플 이미지로 명시적으로 되돌린다 — null로 두면 이
// 화면(BrandingSlot)의 defaultUrl prop을 그대로 쓰게 되는데, 로고는
// 그래도 되지만 도장은 항상 샘플이어야 하므로 이제 로고/도장 모두
// 결과적으로 안전한 기본값을 보게 된다.
export async function resetBrandingImage(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const { supabase, isAdmin } = await requireAdmin();
  if (!isAdmin) return { error: "관리자만 이미지를 변경할 수 있습니다." };

  const slot = String(formData.get("slot") ?? "") as BrandingSlot;
  if (!(slot in BRANDING_SLOTS)) {
    return { error: "잘못된 요청입니다." };
  }

  const { data: isDemo, error: isDemoError } = await supabase.rpc("is_demo_actor");
  if (isDemoError) {
    return { error: `계정 종류를 확인하지 못해 되돌리기를 중단했습니다: ${isDemoError.message}` };
  }

  const resetValue = isDemo ? DEMO_DEFAULT_URLS[slot] : null;
  const update =
    slot === "logo_wordmark_url"
      ? { logo_wordmark_url: resetValue }
      : slot === "logo_mark_url"
        ? { logo_mark_url: resetValue }
        : { seal_image_url: resetValue };

  // DB가 WHERE절 없는 UPDATE를 막고 있어서 형식상 항상 참인 조건을
  // 붙여준다 — 실제 행 선택은 위 uploadBrandingImage와 동일하게 RLS가 한다.
  const { error } = await supabase.from("company_profile").update(update).not("id", "is", null);

  if (error) {
    return { error: `되돌리기에 실패했습니다: ${error.message}` };
  }

  revalidatePath("/", "layout");
  return { success: "기본값으로 되돌렸습니다." };
}
