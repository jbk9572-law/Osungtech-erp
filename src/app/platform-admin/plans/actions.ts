"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/require-platform-admin";
import type { FormState } from "@/components/form-message";

const INCLUDED_FIELDS = [
  ["included_db_mb", "DB 용량(MB)"],
  ["included_file_gb", "파일 저장소(GB)"],
  ["included_vendor_limit", "외주처 연동 수"],
  ["included_email_quota", "월 이메일 발송 건수"],
  ["included_fax_quota", "월 팩스 발송 건수"],
  ["included_invoice_quota", "월 계산서 발행 건수"],
  ["included_alimtalk_quota", "월 알림톡/문자 발송 건수"],
] as const;

// 요금제 설명 문구에 "DB 50MB" 같은 숫자를 적어놔도 실제로 그 숫자를
// 입력할 데가 없었다는 지적 — 구조화된 기본값(migration 191)을 폼에서
// 받는다. 빈 칸으로 두면 "이 요금제는 이 항목에 기본값을 안 정한다"는
// 뜻이라 null로 저장한다(0과는 다르다 — 0은 "포함 안 함"이 될 수도
// 있는 값이라 구분해야 한다).
function parseIncludedFields(formData: FormData): { values: Record<string, number | null> } | { error: string } {
  const values: Record<string, number | null> = {};
  for (const [field, label] of INCLUDED_FIELDS) {
    const raw = String(formData.get(field) ?? "").trim();
    if (!raw) {
      values[field] = null;
      continue;
    }
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) {
      return { error: `${label}은 0 이상의 숫자이거나 빈 칸이어야 합니다.` };
    }
    values[field] = Math.round(n);
  }
  return { values };
}

export async function createPlatformPlan(_prevState: FormState, formData: FormData): Promise<FormState> {
  const { supabase, isPlatformAdmin } = await requirePlatformAdmin();
  if (!isPlatformAdmin) return { error: "플랫폼 운영자만 요금제를 추가할 수 있습니다." };

  const planKey = String(formData.get("plan_key") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const monthlyPrice = Number(formData.get("monthly_price") ?? 0);
  const description = String(formData.get("description") ?? "").trim();
  const included = parseIncludedFields(formData);
  if ("error" in included) return included;

  if (!planKey || !name) return { error: "요금제 키와 이름을 입력해주세요." };
  if (!/^[a-z0-9_-]{2,32}$/.test(planKey)) {
    return { error: "요금제 키는 영문 소문자/숫자/하이픈/언더스코어(2~32자)만 사용할 수 있습니다." };
  }
  if (!Number.isFinite(monthlyPrice) || monthlyPrice < 0) {
    return { error: "월 가격은 0 이상의 숫자여야 합니다." };
  }

  const { error } = await supabase.from("platform_plans").insert({
    plan_key: planKey,
    name,
    monthly_price: monthlyPrice,
    description: description || null,
    ...included.values,
  });
  if (error) {
    const isDuplicate = error.message.toLowerCase().includes("duplicate");
    return { error: isDuplicate ? "이미 사용 중인 요금제 키입니다." : `등록에 실패했습니다: ${error.message}` };
  }

  revalidatePath("/platform-admin/plans");
  return { success: "요금제를 등록했습니다." };
}

export async function updatePlatformPlan(_prevState: FormState, formData: FormData): Promise<FormState> {
  const { supabase, isPlatformAdmin } = await requirePlatformAdmin();
  if (!isPlatformAdmin) return { error: "플랫폼 운영자만 수정할 수 있습니다." };

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const monthlyPrice = Number(formData.get("monthly_price") ?? 0);
  const description = String(formData.get("description") ?? "").trim();
  const isActive = formData.get("is_active") === "1";
  const included = parseIncludedFields(formData);
  if ("error" in included) return included;

  if (!id || !name) return { error: "이름을 입력해주세요." };
  if (!Number.isFinite(monthlyPrice) || monthlyPrice < 0) {
    return { error: "월 가격은 0 이상의 숫자여야 합니다." };
  }

  const { error } = await supabase
    .from("platform_plans")
    .update({
      name,
      monthly_price: monthlyPrice,
      description: description || null,
      is_active: isActive,
      ...included.values,
    })
    .eq("id", id);
  if (error) return { error: `저장에 실패했습니다: ${error.message}` };

  revalidatePath("/platform-admin/plans");
  return { success: "저장했습니다." };
}

export async function deletePlatformPlan(_prevState: FormState, formData: FormData): Promise<FormState> {
  const { supabase, isPlatformAdmin } = await requirePlatformAdmin();
  if (!isPlatformAdmin) return { error: "플랫폼 운영자만 삭제할 수 있습니다." };

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "잘못된 요청입니다." };

  const { error } = await supabase.from("platform_plans").delete().eq("id", id);
  if (error) return { error: `삭제에 실패했습니다: ${error.message}` };

  revalidatePath("/platform-admin/plans");
  return { success: "삭제했습니다." };
}
