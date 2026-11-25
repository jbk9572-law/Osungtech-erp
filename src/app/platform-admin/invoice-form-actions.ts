"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/require-platform-admin";
import { ALL_INVOICE_FORMS } from "@/lib/invoice-form";
import type { FormState } from "@/components/form-message";

// 회사(테넌트)별 사용 가능한 인쇄 서식(명세표) 지정 — tenants.allowed_invoice_forms(migration 282).
// 체크한 서식만 그 회사 인쇄 화면의 서식 선택 줄에 나온다. "기존 규칙으로"를 누르면 지정을 비워(NULL) 테마·회사 식별자 규칙으로 돌아간다.
export async function setTenantInvoiceForms(_prevState: FormState, formData: FormData): Promise<FormState> {
  const { isPlatformAdmin, supabase } = await requirePlatformAdmin();
  if (!isPlatformAdmin) return { error: "플랫폼 운영자만 변경할 수 있습니다." };

  const tenantId = String(formData.get("tenantId") ?? "");
  if (!tenantId) return { error: "회사를 먼저 선택해주세요." };

  if (formData.get("reset")) {
    const { error } = await supabase.rpc("set_tenant_invoice_forms", { p_tenant_id: tenantId, p_forms: null });
    if (error) return { error: `변경에 실패했습니다: ${error.message}` };
    revalidatePath("/platform-admin/settings");
    return { success: "지정을 풀었습니다(기존 규칙을 따릅니다)." };
  }

  const forms = ALL_INVOICE_FORMS.filter((f) => formData.getAll("forms").map(String).includes(f));
  if (forms.length === 0) return { error: "서식을 하나 이상 골라주세요." };

  const { error } = await supabase.rpc("set_tenant_invoice_forms", { p_tenant_id: tenantId, p_forms: forms });
  if (error) return { error: `변경에 실패했습니다: ${error.message}` };

  revalidatePath("/platform-admin/settings");
  return { success: "인쇄 서식을 적용했습니다." };
}
