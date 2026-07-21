"use server";

import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/components/form-message";

export async function changePassword(_prevState: FormState, formData: FormData): Promise<FormState> {
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { error: "모든 항목을 입력해주세요." };
  }
  if (newPassword.length < 6) {
    return { error: "새 비밀번호는 6자 이상이어야 합니다." };
  }
  if (newPassword !== confirmPassword) {
    return { error: "새 비밀번호가 서로 일치하지 않습니다." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return { error: "로그인 정보를 확인할 수 없습니다." };
  }

  // 현재 세션이 있어도 updateUser는 비밀번호를 검증 없이 바꿔버리므로, 다른
  // 사람이 잠깐 자리를 비운 화면을 만졌을 때를 대비해 현재 비밀번호가
  // 맞는지 먼저 로그인 시도로 확인한다.
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (verifyError) {
    return { error: "현재 비밀번호가 올바르지 않습니다." };
  }

  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
  if (updateError) {
    return { error: updateError.message };
  }

  return { success: "비밀번호를 변경했습니다." };
}
