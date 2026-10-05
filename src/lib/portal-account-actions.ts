"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/require-admin";
import type { FormState } from "@/components/form-message";

function generatePortalPassword(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 10);
}

type PortalAccountKind = "customer" | "subcontractor";

function isPortalAccountKind(value: string): value is PortalAccountKind {
  return value === "customer" || value === "subcontractor";
}

// 거래처/업체(하청) 포털 계정 공용 발급 — settings/users/actions.ts의
// createUserAccount와 같은 service_role 경로를 쓰지만, user_metadata에
// tenant_id 대신 portal_customer_id 또는 portal_subcontractor_id를 실어서
// handle_new_user() 트리거가 완전히 다른 분기(customer_portal_accounts
// 전용, profiles/tenant_members는 안 건드림)를 타게 한다 — 그래서 포털
// 계정은 내부 직원 권한 체계에 전혀 섞이지 않는다. 거래처용으로 먼저
// 만들었던 걸(migration 165) 업체(하청) 포털까지 kind로 분기해 재사용한다
// — 로그인/발급 방식이 완전히 같기 때문.
//
// 아이디는 직원 계정(createUserAccount)과 똑같이 이메일 형식을 요구하지
// 않는다 — 실제 로그인은 내부적으로 합성 이메일(아이디@테넌트.portal.
// elvonix.local)로 Supabase Auth에 들어가고, 로그인 화면에서는
// get_portal_email_for_username()이 이 아이디를 그 이메일로 바꿔준다.
// 비밀번호는 직접 입력하지 않으면 자동 생성하고, 둘 다 화면에 "한 번만"
// 보여주고 저장하지 않는다(직원이 그 자리에서 전달).
export async function createPortalAccount(_prevState: FormState, formData: FormData): Promise<FormState> {
  const { supabase, isAdmin } = await requireAdmin();
  if (!isAdmin) return { error: "관리자만 포털 계정을 발급할 수 있습니다." };

  const kindRaw = String(formData.get("kind") ?? "customer");
  if (!isPortalAccountKind(kindRaw)) return { error: "잘못된 요청입니다." };
  const kind = kindRaw;
  const targetId = String(formData.get("target_id") ?? "");
  const username = String(formData.get("username") ?? "").trim();
  const customPassword = String(formData.get("password") ?? "");
  if (!targetId || !username) {
    return { error: kind === "subcontractor" ? "업체와 아이디를 확인해주세요." : "거래처와 아이디를 확인해주세요." };
  }
  if (!/^[a-zA-Z0-9_.-]{2,32}$/.test(username)) {
    return { error: "아이디는 영문/숫자/일부 기호(2~32자)만 사용할 수 있습니다." };
  }
  if (customPassword && customPassword.length < 6) {
    return { error: "비밀번호는 6자 이상이어야 합니다." };
  }

  const table = kind === "subcontractor" ? "subcontractors" : "customers";
  const { data: target } = await supabase.from(table).select("name, tenant_id").eq("id", targetId).maybeSingle();
  if (!target) return { error: kind === "subcontractor" ? "업체를 찾을 수 없습니다." : "거래처를 찾을 수 없습니다." };

  const { data: tenant } = await supabase.from("tenants").select("slug").eq("id", target.tenant_id).maybeSingle();
  if (!tenant) return { error: "소속 테넌트를 확인하지 못했습니다." };

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "관리자 클라이언트 초기화에 실패했습니다." };
  }

  const password = customPassword || generatePortalPassword();
  const email = `${username}@${tenant.slug}.portal.elvonix.local`;
  const metadataKey = kind === "subcontractor" ? "portal_subcontractor_id" : "portal_customer_id";
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { [metadataKey]: targetId, username },
  });

  if (error || !created.user) {
    const isDuplicate = error?.message?.toLowerCase().includes("already");
    return { error: isDuplicate ? "이미 사용 중인 아이디입니다." : (error?.message ?? "계정 생성에 실패했습니다.") };
  }

  revalidatePath(kind === "subcontractor" ? "/subcontractors" : "/customers");
  return {
    success: `포털 계정을 발급했습니다. 아이디: ${username} / 비밀번호: ${password} (지금 전달해주세요 — 다시 보여드리지 않습니다)`,
  };
}

export async function disablePortalAccount(_prevState: FormState, formData: FormData): Promise<FormState> {
  const { supabase, isAdmin } = await requireAdmin();
  if (!isAdmin) return { error: "관리자만 처리할 수 있습니다." };

  const id = String(formData.get("id") ?? "");
  const kindRaw = String(formData.get("kind") ?? "customer");
  if (!id || !isPortalAccountKind(kindRaw)) return { error: "잘못된 요청입니다." };

  const { error } = await supabase.from("customer_portal_accounts").update({ disabled: true }).eq("id", id);
  if (error) return { error: `비활성화에 실패했습니다: ${error.message}` };

  revalidatePath(kindRaw === "subcontractor" ? "/subcontractors" : "/customers");
  return { success: "포털 계정을 비활성화했습니다." };
}
