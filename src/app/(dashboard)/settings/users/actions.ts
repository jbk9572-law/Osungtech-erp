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
  if (!user) return { supabase, isAdmin: false, selfId: null as string | null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  return { supabase, isAdmin: profile?.role === "admin", selfId: user.id };
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
  const { supabase, isAdmin, selfId } = await requireAdmin();
  if (!isAdmin) return;

  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "");
  if (!userId || userId === selfId || !isRole(role)) return;

  await supabase.from("profiles").update({ role }).eq("id", userId);
  revalidatePath("/settings/users");
}

// 계정 상세(수정) 화면에서 이름/아이디/역할/비밀번호를 한 번에 바꾼다. 이름과
// 역할은 profiles 테이블만 건드리면 되지만(RLS로 처리), 아이디를 바꾸면
// 로그인에 쓰는 이메일("아이디@osungtech.local")도 같이 바뀌어야 하고
// 비밀번호 재설정도 auth.users를 직접 건드려야 해서 이 두 경우에만
// service_role 클라이언트가 필요하다.
export async function updateUserAccount(_prevState: FormState, formData: FormData): Promise<FormState> {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) return { error: "관리자만 계정을 수정할 수 있습니다." };

  const userId = String(formData.get("userId") ?? "");
  const username = String(formData.get("username") ?? "").trim();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const newPassword = String(formData.get("newPassword") ?? "");
  const role = String(formData.get("role") ?? "staff");

  if (!userId || !username || !fullName) {
    return { error: "아이디와 이름은 비워둘 수 없습니다." };
  }
  if (!/^[a-zA-Z0-9_.-]{2,32}$/.test(username)) {
    return { error: "아이디는 영문/숫자/일부 기호(2~32자)만 사용할 수 있습니다." };
  }
  if (newPassword && newPassword.length < 6) {
    return { error: "새 비밀번호는 6자 이상이어야 합니다." };
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
  const { error: authError } = await admin.auth.admin.updateUserById(userId, {
    email,
    ...(newPassword ? { password: newPassword } : {}),
    user_metadata: { full_name: fullName, username },
  });
  if (authError) {
    const isDuplicate = authError.message?.toLowerCase().includes("already");
    return { error: isDuplicate ? "이미 존재하는 아이디입니다." : authError.message };
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({ username, full_name: fullName, email, role })
    .eq("id", userId);
  if (profileError) return { error: profileError.message };

  revalidatePath("/settings/users");
  revalidatePath(`/settings/users/${userId}`);
  return { success: "계정 정보를 저장했습니다." };
}

// 계정 삭제. auth.users에서 지우면 profiles 행도 on delete cascade로 같이
// 지워진다. 본인 계정은 실수로 스스로를 잠그는 걸 막기 위해 삭제할 수 없다.
export async function deleteUserAccount(_prevState: FormState, formData: FormData): Promise<FormState> {
  const { isAdmin, selfId } = await requireAdmin();
  if (!isAdmin) return { error: "관리자만 계정을 삭제할 수 있습니다." };

  const userId = String(formData.get("id") ?? "");
  if (!userId) return { error: "잘못된 요청입니다." };
  if (userId === selfId) return { error: "본인 계정은 삭제할 수 없습니다." };

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "관리자 클라이언트 초기화에 실패했습니다." };
  }

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { error: error.message };

  revalidatePath("/settings/users");
  return { success: "계정을 삭제했습니다." };
}
