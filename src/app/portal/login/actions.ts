"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { portalHref } from "@/lib/portal-path";
import {
  clientIpFromHeaders,
  recordLoginFailure,
  recordLoginSuccess,
  throttleRemainingSeconds,
} from "@/lib/login-throttle";

export async function portalLogin(
  _prevState: { error: string } | undefined,
  formData: FormData,
): Promise<{ error: string } | undefined> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "이메일과 비밀번호를 입력해주세요." };
  }

  // 직원 로그인(/login)과 같은 시도 횟수 제한 — 비밀번호 대입 공격 방지.
  const ip = clientIpFromHeaders(await headers());
  const throttleId = `portal/${email}`;
  const waitSeconds = throttleRemainingSeconds(ip, throttleId);
  if (waitSeconds > 0) {
    return { error: `로그인 시도가 너무 많습니다. ${Math.ceil(waitSeconds / 60)}분 뒤에 다시 시도해주세요.` };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    recordLoginFailure(ip, throttleId);
    return { error: "이메일 또는 비밀번호가 올바르지 않습니다." };
  }
  recordLoginSuccess(ip, throttleId);

  // 내부 직원 계정으로 여기 로그인하거나(가능하지만 포털 전용 데이터가
  // 하나도 없음), 비활성화된 포털 계정이면 바로 로그아웃시키고 안내한다
  // — 로그인 자체는 성공했어도 이 화면에 들어올 자격이 없는 세션을
  // 남겨두지 않는다. 거래처/업체(하청) 포털 계정 둘 다 받아준다.
  const { data: identity, error: identityError } = await supabase.rpc("portal_identity");
  if (identityError || !identity || identity.length === 0) {
    await supabase.auth.signOut();
    return { error: "포털 계정이 아니거나 비활성화된 계정입니다. 담당 직원에게 문의해주세요." };
  }

  // 중복 로그인 방지: /login과 동일하게, 방금 만든 이 세션만 남기고 그
  // 계정의 다른 모든 세션을 강제 종료한다("최신 로그인만 유지" 정책).
  await supabase.auth.signOut({ scope: "others" });

  redirect(await portalHref(""));
}

export async function portalLogout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(await portalHref("/login"));
}
