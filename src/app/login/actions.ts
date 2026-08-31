"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function login(_prevState: { error: string } | undefined, formData: FormData) {
  const loginId = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!loginId || !password) {
    return { error: "아이디와 비밀번호를 입력해주세요." };
  }

  const supabase = await createClient();

  // "admin"처럼 이메일 형식이 아니면 아이디로 보고, DB에 등록된 이메일을
  // 찾아서 그 이메일로 로그인한다(Supabase Auth 자체는 이메일 기반이라
  // 아이디 로그인을 직접 지원하지 않는다).
  let email = loginId;
  if (!loginId.includes("@")) {
    // get_email_for_username은 로그인 전(비로그인/anon) 상태에서 호출돼야
    // 하는데, anon에게 직접 실행 권한을 주면 앱을 거치지 않고 공개된 anon
    // key만으로 REST API를 직접 두드려 아이디 존재 여부/이메일을 무제한
    // 조회(계정 목록 수집)할 수 있다. 그래서 이 함수는 service_role에게만
    // 실행 권한이 있고(migration 75), 서버 액션 안에서 관리자 클라이언트로만
    // 호출한다 — 클라이언트(브라우저)는 이 조회 자체에 관여하지 않는다.
    let admin;
    try {
      admin = createAdminClient();
    } catch {
      return { error: "일시적인 오류로 로그인할 수 없습니다. 잠시 후 다시 시도해주세요." };
    }
    const { data: resolvedEmail, error: lookupError } = await admin.rpc("get_email_for_username", {
      p_username: loginId,
    });
    // 조회 자체가 실패한 경우(네트워크 오류 등)와 "그런 아이디가 없음"을
    // 구분한다 — 둘 다 뭉뚱그려 "존재하지 않는 아이디입니다"라고 하면,
    // 실제로는 아이디가 있는데 일시적인 연결 문제였을 때도 사용자가
    // 자기 아이디가 잘못됐다고 오해하게 된다.
    if (lookupError) {
      return { error: "일시적인 오류로 로그인할 수 없습니다. 잠시 후 다시 시도해주세요." };
    }
    if (!resolvedEmail) {
      return { error: "존재하지 않는 아이디입니다." };
    }
    email = resolvedEmail;
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "로그인에 실패했습니다. 아이디와 비밀번호를 확인해주세요." };
  }

  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
