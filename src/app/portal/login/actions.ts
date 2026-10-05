"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { portalHref } from "@/lib/portal-path";

export async function portalLogin(
  _prevState: { error: string } | undefined,
  formData: FormData,
): Promise<{ error: string } | undefined> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "이메일과 비밀번호를 입력해주세요." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: "이메일 또는 비밀번호가 올바르지 않습니다." };
  }

  // 내부 직원 계정으로 여기 로그인하거나(가능하지만 포털 전용 데이터가
  // 하나도 없음), 비활성화된 포털 계정이면 바로 로그아웃시키고 안내한다
  // — 로그인 자체는 성공했어도 이 화면에 들어올 자격이 없는 세션을
  // 남겨두지 않는다.
  const { data: whoami, error: whoamiError } = await supabase.rpc("portal_whoami");
  if (whoamiError || !whoami || whoami.length === 0) {
    await supabase.auth.signOut();
    return { error: "포털 계정이 아니거나 비활성화된 계정입니다. 담당 직원에게 문의해주세요." };
  }

  redirect(await portalHref(""));
}

export async function portalLogout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(await portalHref("/login"));
}
