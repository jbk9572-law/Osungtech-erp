"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/require-platform-admin";
import type { FormState } from "@/components/form-message";

export async function createPlatformPlan(_prevState: FormState, formData: FormData): Promise<FormState> {
  const { supabase, isPlatformAdmin } = await requirePlatformAdmin();
  if (!isPlatformAdmin) return { error: "플랫폼 운영자만 요금제를 추가할 수 있습니다." };

  const planKey = String(formData.get("plan_key") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const monthlyPrice = Number(formData.get("monthly_price") ?? 0);
  const description = String(formData.get("description") ?? "").trim();

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

  if (!id || !name) return { error: "이름을 입력해주세요." };
  if (!Number.isFinite(monthlyPrice) || monthlyPrice < 0) {
    return { error: "월 가격은 0 이상의 숫자여야 합니다." };
  }

  const { error } = await supabase
    .from("platform_plans")
    .update({ name, monthly_price: monthlyPrice, description: description || null, is_active: isActive })
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
