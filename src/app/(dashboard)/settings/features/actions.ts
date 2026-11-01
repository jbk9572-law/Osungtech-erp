"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/components/form-message";

// set_tenant_feature_enabled() RPC(migration 104)로 배열을 원자적으로
// 갱신한다 — 관리자 여부/소속 테넌트 검증은 RPC 안에서 한다.
export async function setTenantFeatureEnabled(_prevState: FormState, formData: FormData): Promise<FormState> {
  const featureKey = String(formData.get("feature_key") ?? "");
  const enabled = formData.get("enabled") === "1";
  if (!featureKey) return { error: "잘못된 요청입니다." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_tenant_feature_enabled", {
    p_feature_key: featureKey,
    p_enabled: enabled,
  });

  if (error) {
    return { error: `저장에 실패했습니다: ${error.message}` };
  }

  // 메뉴 표시는 layout.tsx가 매 요청마다 다시 계산하므로, 레이아웃을
  // 포함해 무효화해야 트리메뉴/타이틀바가 바로 갱신된다(settings/company의
  // 로고 갱신과 같은 이유).
  revalidatePath("/", "layout");
  return { success: enabled ? "기능을 켰습니다." : "기능을 껐습니다." };
}

// 마감일(tenants.closing_date, migration 207) 저장 — 이 날짜 이전 거래일자의
// 매출/매입 전표는 관리자만 수정/삭제할 수 있다. RPC 없이 테이블을 직접
// update하는 이유: tenants_update_admin RLS 정책(migration 104)이 이미
// "자기 테넌트 + 관리자"로 걸려 있어 별도 검증 함수가 필요 없다 — 위
// setTenantFeatureEnabled가 RPC를 쓰는 건 배열 원자적 갱신(array_append/
// remove 동시성)이 필요해서고, 단일 컬럼 값 교체는 그냥 update로 충분하다.
export async function setTenantClosingDate(_prevState: FormState, formData: FormData): Promise<FormState> {
  const raw = String(formData.get("closing_date") ?? "").trim();
  const closingDate = raw === "" ? null : raw;

  const supabase = await createClient();
  const { data: tenant } = await supabase.from("tenants").select("id").maybeSingle();
  if (!tenant) return { error: "소속된 테넌트가 없습니다." };

  const { error } = await supabase.from("tenants").update({ closing_date: closingDate }).eq("id", tenant.id);
  if (error) {
    return { error: `저장에 실패했습니다: ${error.message}` };
  }

  revalidatePath("/settings/features");
  return { success: closingDate ? `마감일을 ${closingDate}로 설정했습니다.` : "마감일 제한을 해제했습니다." };
}
