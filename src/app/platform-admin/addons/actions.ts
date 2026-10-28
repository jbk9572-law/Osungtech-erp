"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/require-platform-admin";
import type { FormState } from "@/components/form-message";

// add_on_products.kind 체크 제약(migration 194)과 반드시 같은 5개만
// 허용한다 — 여기서 하나 늘리려면 그 제약도 같이 바꿔야 한다는 뜻이고,
// 그게 곧 "새 kind는 코드 수정 없이는 못 만든다"는 설계 의도다(같은
// kind의 새 상품을 등록하는 건 코드 수정 없이 가능 — 기획서가 말하는
// 범위는 거기까지).
const ADDON_KINDS = ["fax", "invoice", "alimtalk", "vendor", "storage"] as const;
type AddOnKind = (typeof ADDON_KINDS)[number];

function isAddonKind(v: string): v is AddOnKind {
  return (ADDON_KINDS as readonly string[]).includes(v);
}

export async function createAddOnProduct(_prevState: FormState, formData: FormData): Promise<FormState> {
  const { supabase, isPlatformAdmin } = await requirePlatformAdmin();
  if (!isPlatformAdmin) return { error: "플랫폼 운영자만 애드온을 추가할 수 있습니다." };

  const key = String(formData.get("key") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const kind = String(formData.get("kind") ?? "").trim();
  const capacity = Number(formData.get("capacity") ?? 0);
  const monthlyPrice = Number(formData.get("monthly_price") ?? 0);

  if (!key || !name) return { error: "애드온 키와 이름을 입력해주세요." };
  if (!/^[a-z0-9_-]{2,64}$/.test(key)) {
    return { error: "애드온 키는 영문 소문자/숫자/하이픈/언더스코어(2~64자)만 사용할 수 있습니다." };
  }
  if (!isAddonKind(kind)) return { error: "적용 유형을 선택해주세요." };
  if (!Number.isFinite(capacity) || capacity <= 0) {
    return { error: "제공 용량/건수는 0보다 큰 숫자여야 합니다." };
  }
  if (!Number.isFinite(monthlyPrice) || monthlyPrice < 0) {
    return { error: "월 가격은 0 이상의 숫자여야 합니다." };
  }

  const { error } = await supabase.from("add_on_products").insert({
    key,
    name,
    kind,
    capacity: Math.round(capacity),
    monthly_price: Math.round(monthlyPrice),
  });
  if (error) {
    const isDuplicate = error.message.toLowerCase().includes("duplicate");
    return { error: isDuplicate ? "이미 사용 중인 애드온 키입니다." : `등록에 실패했습니다: ${error.message}` };
  }

  revalidatePath("/platform-admin/addons");
  return { success: "애드온을 등록했습니다." };
}

export async function updateAddOnProduct(_prevState: FormState, formData: FormData): Promise<FormState> {
  const { supabase, isPlatformAdmin } = await requirePlatformAdmin();
  if (!isPlatformAdmin) return { error: "플랫폼 운영자만 수정할 수 있습니다." };

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const kind = String(formData.get("kind") ?? "").trim();
  const capacity = Number(formData.get("capacity") ?? 0);
  const monthlyPrice = Number(formData.get("monthly_price") ?? 0);
  const isActive = formData.get("is_active") === "1";

  if (!id || !name) return { error: "이름을 입력해주세요." };
  if (!isAddonKind(kind)) return { error: "적용 유형을 선택해주세요." };
  if (!Number.isFinite(capacity) || capacity <= 0) {
    return { error: "제공 용량/건수는 0보다 큰 숫자여야 합니다." };
  }
  if (!Number.isFinite(monthlyPrice) || monthlyPrice < 0) {
    return { error: "월 가격은 0 이상의 숫자여야 합니다." };
  }

  const { error } = await supabase
    .from("add_on_products")
    .update({
      name,
      kind,
      capacity: Math.round(capacity),
      monthly_price: Math.round(monthlyPrice),
      is_active: isActive,
    })
    .eq("id", id);
  if (error) return { error: `저장에 실패했습니다: ${error.message}` };

  revalidatePath("/platform-admin/addons");
  return { success: "저장했습니다." };
}

export async function deleteAddOnProduct(_prevState: FormState, formData: FormData): Promise<FormState> {
  const { supabase, isPlatformAdmin } = await requirePlatformAdmin();
  if (!isPlatformAdmin) return { error: "플랫폼 운영자만 삭제할 수 있습니다." };

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "잘못된 요청입니다." };

  const { error } = await supabase.from("add_on_products").delete().eq("id", id);
  if (error) return { error: `삭제에 실패했습니다: ${error.message}` };

  revalidatePath("/platform-admin/addons");
  return { success: "삭제했습니다." };
}
