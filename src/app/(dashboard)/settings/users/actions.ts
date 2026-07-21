"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { FormState } from "@/components/form-message";

const ROLES = ["admin", "manager", "staff"] as const;
type Role = (typeof ROLES)[number];

function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, isAdmin: false };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  return { supabase, isAdmin: profile?.role === "admin" };
}

// 관리자 전용 계정 생성. 이메일 대신 아이디만 입력받고, 실제 Supabase Auth용
// 이메일은 "아이디@osungtech.local"로 자동 생성한다(로그인 화면에서 아이디를
// 입력하면 이 이메일로 변환되어 로그인된다). service_role 키가 필요해서
// 서버 환경변수(SUPABASE_SERVICE_ROLE_KEY)가 없으면 실패한다.
export async function createUserAccount(_prevState: FormState, formData: FormData): Promise<FormState> {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) return { error: "관리자만 계정을 생성할 수 있습니다." };

  const username = String(formData.get("username") ?? "").trim();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "staff");

  if (!username || !password || !fullName) {
    return { error: "아이디, 이름, 비밀번호를 모두 입력해주세요." };
  }
  if (!/^[a-zA-Z0-9_.-]{2,32}$/.test(username)) {
    return { error: "아이디는 영문/숫자/일부 기호(2~32자)만 사용할 수 있습니다." };
  }
  if (password.length < 6) {
    return { error: "비밀번호는 6자 이상이어야 합니다." };
  }
  if (!isRole(role)) {
    return { error: "역할 값이 올바르지 않습니다." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "관리자 클라이언트 초기화에 실패했습니다." };
  }

  const email = `${username}@osungtech.local`;
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, username },
  });

  if (error || !created.user) {
    const isDuplicate = error?.message?.toLowerCase().includes("already");
    return { error: isDuplicate ? "이미 존재하는 아이디입니다." : (error?.message ?? "계정 생성에 실패했습니다.") };
  }

  const { error: roleError } = await admin.from("profiles").update({ role }).eq("id", created.user.id);
  if (roleError) return { error: roleError.message };

  revalidatePath("/settings/users");
  return { success: "계정을 생성했습니다." };
}

// 이미 만들어진 계정의 역할(권한)을 변경한다. service_role 없이도 RLS 정책
// (profiles_update_by_admin)으로 관리자 본인 세션에서 바로 처리된다.
export async function updateUserRole(formData: FormData) {
  const { supabase, isAdmin } = await requireAdmin();
  if (!isAdmin) return;

  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "");
  if (!userId || !isRole(role)) return;

  await supabase.from("profiles").update({ role }).eq("id", userId);
  revalidatePath("/settings/users");
}
