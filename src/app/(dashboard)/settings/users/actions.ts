"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/require-admin";
import type { FormState } from "@/components/form-message";

const ROLES = ["admin", "manager", "staff"] as const;
type Role = (typeof ROLES)[number];

function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
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
  if (roleError) {
    // auth 계정은 이미 만들어졌는데 역할 지정이 실패하면, 기본 역할(staff)
    // 그대로 로그인 가능한 반쪽짜리 계정이 조용히 남는다 — 관리자에게는
    // "실패했다"고만 보이므로, 실패를 알리는 것에 그치지 않고 방금 만든
    // auth 계정 자체를 지워서 되돌린다.
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: `역할 지정에 실패해 계정 생성을 취소했습니다: ${roleError.message}` };
  }

  revalidatePath("/settings/users");
  return { success: "계정을 생성했습니다." };
}

// 이미 만들어진 계정의 역할(권한)을 변경한다. service_role 없이도 RLS 정책
// (profiles_update_by_admin)으로 관리자 본인 세션에서 바로 처리된다.
export async function updateUserRole(formData: FormData): Promise<{ error: string } | undefined> {
  const { supabase, isAdmin, selfId } = await requireAdmin();
  if (!isAdmin) return { error: "관리자만 변경할 수 있습니다." };

  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "");
  if (!userId || userId === selfId || !isRole(role)) {
    return { error: "잘못된 요청입니다." };
  }

  const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);
  if (error) {
    return { error: `역할 변경에 실패했습니다: ${error.message}` };
  }
  revalidatePath("/settings/users");
}

// 계정 상세(수정) 화면에서 이름/아이디/역할/비밀번호를 한 번에 바꾼다. 이름과
// 역할은 profiles 테이블만 건드리면 되지만(RLS로 처리), 아이디를 바꾸면
// 로그인에 쓰는 이메일("아이디@osungtech.local")도 같이 바뀌어야 하고
// 비밀번호 재설정도 auth.users를 직접 건드려야 해서 이 두 경우에만
// service_role 클라이언트가 필요하다.
export async function updateUserAccount(_prevState: FormState, formData: FormData): Promise<FormState> {
  const { supabase, isAdmin, selfId } = await requireAdmin();
  if (!isAdmin) return { error: "관리자만 계정을 수정할 수 있습니다." };

  const userId = String(formData.get("userId") ?? "");
  const username = String(formData.get("username") ?? "").trim();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const newPassword = String(formData.get("newPassword") ?? "");
  const submittedRole = String(formData.get("role") ?? "staff");

  if (!userId || !username || !fullName) {
    return { error: "아이디와 이름은 비워둘 수 없습니다." };
  }
  if (!/^[a-zA-Z0-9_.-]{2,32}$/.test(username)) {
    return { error: "아이디는 영문/숫자/일부 기호(2~32자)만 사용할 수 있습니다." };
  }
  if (newPassword && newPassword.length < 6) {
    return { error: "새 비밀번호는 6자 이상이어야 합니다." };
  }
  if (!isRole(submittedRole)) {
    return { error: "역할 값이 올바르지 않습니다." };
  }
  let role: Role = submittedRole;
  // updateUserRole과 동일한 규칙: 본인 계정의 역할은 바꿀 수 없다. 화면은
  // 숨김 input으로 현재 역할을 그대로 되돌려 보내지만, 그건 클라이언트
  // 값이라 변조될 수 있으므로 서버에서도 강제한다 — 폼 값을 무시하고 DB에
  // 이미 저장된 역할을 그대로 유지한다.
  if (userId === selfId) {
    const { data: currentProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();
    if (currentProfile && isRole(currentProfile.role)) {
      role = currentProfile.role;
    }
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
  if (profileError) {
    // 로그인 정보(auth)는 이미 새 값으로 바뀐 뒤라 되돌릴 수 없다(특히
    // 비밀번호는 해시만 남아 이전 값 자체를 모른다) — 목록 화면에는 예전
    // 정보가 그대로 보여서 "아무 일도 안 일어난 것"처럼 보이면 안 되므로,
    // 로그인 정보는 이미 바뀌었다는 사실을 명확히 알린다. 같은 값으로 다시
    // 저장을 시도하면 profiles만 갱신되어 정상화된다.
    return {
      error: `로그인 정보는 이미 변경됐지만 화면에 표시되는 계정 정보 저장에 실패했습니다: ${profileError.message} — 같은 값으로 다시 저장해주세요.`,
    };
  }

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
