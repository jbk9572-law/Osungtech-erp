"use server";

import { isPasswordLongEnough, MIN_PASSWORD_LENGTH } from "@/lib/password-policy";
import { headers } from "next/headers";
import { createClient, getUser } from "@/lib/supabase/server";
import {
  clientIpFromHeaders,
  recordLoginFailure,
  recordLoginSuccess,
  throttleRemainingSeconds,
} from "@/lib/login-throttle";
import type { FormState } from "@/components/form-message";

export async function changePassword(_prevState: FormState, formData: FormData): Promise<FormState> {
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { error: "모든 항목을 입력해주세요." };
  }
  if (!isPasswordLongEnough(newPassword)) {
    return { error: `새 비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.` };
  }
  if (newPassword !== confirmPassword) {
    return { error: "새 비밀번호가 서로 일치하지 않습니다." };
  }

  const supabase = await createClient();
  const user = await getUser();
  if (!user?.email) {
    return { error: "로그인 정보를 확인할 수 없습니다." };
  }

  // 현재 세션이 있어도 updateUser는 비밀번호를 검증 없이 바꿔버리므로, 다른
  // 사람이 잠깐 자리를 비운 화면을 만졌을 때를 대비해 현재 비밀번호가
  // 맞는지 먼저 로그인 시도로 확인한다.
  // 현재 비밀번호 확인도 로그인 시도라서 같은 횟수 제한을 건다 — 자리를 비운 화면을
  // 만진 사람이 현재 비밀번호를 무한히 대입하지 못하게.
  const ip = clientIpFromHeaders(await headers());
  const throttleId = `pw/${user.id}`;
  const waitSeconds = throttleRemainingSeconds(ip, throttleId);
  if (waitSeconds > 0) {
    return { error: `시도가 너무 많습니다. ${Math.ceil(waitSeconds / 60)}분 뒤에 다시 시도해주세요.` };
  }
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (verifyError) {
    recordLoginFailure(ip, throttleId);
    return { error: "현재 비밀번호가 올바르지 않습니다." };
  }
  recordLoginSuccess(ip, throttleId);

  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
  if (updateError) {
    return { error: updateError.message };
  }

  return { success: "비밀번호를 변경했습니다." };
}
