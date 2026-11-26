"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { portalHref } from "@/lib/portal-path";
import {
  clientIpFromHeaders,
  recordLoginFailure,
  recordLoginSuccess,
  throttleRemainingSeconds,
} from "@/lib/login-throttle";

const LOGIN_FAILED = "아이디 또는 비밀번호가 올바르지 않습니다.";

export async function portalLogin(
  _prevState: { error: string } | undefined,
  formData: FormData,
): Promise<{ error: string } | undefined> {
  // 입력칸은 "아이디 또는 이메일" — 포털 계정은 발급할 때 정한 아이디(영문/숫자)로 로그인한다(portal-account-actions.ts).
  // 예전엔 입력칸이 이메일 전용이라 발급한 아이디로는 로그인할 수 없었다(브라우저가 "이메일 형식이 아니다"라며 막음).
  const loginId = String(formData.get("login_id") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!loginId || !password) {
    return { error: "아이디와 비밀번호를 입력해주세요." };
  }

  // 직원 로그인(/login)과 같은 시도 횟수 제한 — 비밀번호 대입 공격 방지.
  const ip = clientIpFromHeaders(await headers());
  const throttleId = `portal/${loginId.toLowerCase()}`;
  const waitSeconds = throttleRemainingSeconds(ip, throttleId);
  if (waitSeconds > 0) {
    return { error: `로그인 시도가 너무 많습니다. ${Math.ceil(waitSeconds / 60)}분 뒤에 다시 시도해주세요.` };
  }

  // 아이디(@ 없음)면 DB에 등록된 로그인용 이메일을 찾아 쓴다(Supabase Auth는 이메일 기반). 이 조회 함수는 비로그인 상태로 REST에서
  // 직접 부르면 아이디 목록을 캐낼 수 있어 service_role에게만 실행 권한이 있다(migration 162) — 서버 액션 안에서만 관리자 클라이언트로 부른다.
  let email = loginId.toLowerCase();
  if (!loginId.includes("@")) {
    let admin;
    try {
      admin = createAdminClient();
    } catch {
      return { error: "일시적인 오류로 로그인할 수 없습니다. 잠시 후 다시 시도해주세요." };
    }
    const { data: portalEmail, error: lookupError } = await admin.rpc("get_portal_email_for_username", { p_username: loginId });
    if (lookupError) return { error: "일시적인 오류로 로그인할 수 없습니다. 잠시 후 다시 시도해주세요." };
    if (!portalEmail) {
      // 없는 아이디도 틀린 비밀번호와 같은 문구로 — 어떤 아이디가 있는지 알아내지 못하게 한다.
      recordLoginFailure(ip, throttleId);
      return { error: LOGIN_FAILED };
    }
    email = portalEmail;
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    recordLoginFailure(ip, throttleId);
    return { error: LOGIN_FAILED };
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
