"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function login(_prevState: { error: string } | undefined, formData: FormData) {
  const companyCode = String(formData.get("companyCode") ?? "").trim().toLowerCase();
  const loginId = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!loginId || !password) {
    return { error: "아이디와 비밀번호를 입력해주세요." };
  }

  const supabase = await createClient();

  // "admin"처럼 이메일 형식이 아니면 아이디로 보고, 회사코드와 함께 DB에
  // 등록된 이메일을 찾아서 그 이메일로 로그인한다(Supabase Auth 자체는
  // 이메일 기반이라 아이디 로그인을 직접 지원하지 않는다). 아이디는 이제
  // 전역이 아니라 회사(테넌트)별로만 유니크하므로(migration 134), 회사코드
  // 없이는 어느 회사의 계정인지 알 수 없다.
  let email = loginId;
  if (!loginId.includes("@")) {
    if (!companyCode) {
      return { error: "회사코드를 입력해주세요." };
    }
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
    // get_email_for_username과 get_login_block_reason은 둘 다 같은
    // (companyCode, loginId) 조합만 보는 순수 조회라 서로 결과에 의존하지
    // 않는다 — 순서대로 따로 기다리면 Supabase 왕복이 그만큼 늘어나
    // 로그인이 느려지므로(클라우드플레어 Workers에서 회사코드+아이디
    // 로그인마다 왕복 하나씩 아꼈다) 동시에 보낸다.
    const [
      { data: resolvedEmail, error: lookupError },
      { data: blockReason, error: blockCheckError },
    ] = await Promise.all([
      admin.rpc("get_email_for_username", { p_slug: companyCode, p_username: loginId }),
      admin.rpc("get_login_block_reason", { p_slug: companyCode, p_username: loginId }),
    ]);

    // 조회 자체가 실패한 경우(네트워크 오류 등)와 "그런 아이디가 없음"을
    // 구분한다 — 둘 다 뭉뚱그려 "존재하지 않는 아이디입니다"라고 하면,
    // 실제로는 아이디가 있는데 일시적인 연결 문제였을 때도 사용자가
    // 자기 아이디가 잘못됐다고 오해하게 된다.
    if (lookupError) {
      return { error: "일시적인 오류로 로그인할 수 없습니다. 잠시 후 다시 시도해주세요." };
    }
    if (!resolvedEmail) {
      return { error: "회사코드 또는 아이디가 올바르지 않습니다." };
    }
    email = resolvedEmail;

    // 플랫폼 관리자가 회사(테넌트)를 비활성화했거나 이용기간이 지났으면,
    // 비밀번호가 맞아도 로그인 자체를 막아야 한다 — 아래
    // signInWithPassword는 그 상태를 모르므로 여기서 먼저 확인한다.
    if (blockCheckError) {
      return { error: "일시적인 오류로 로그인할 수 없습니다. 잠시 후 다시 시도해주세요." };
    }
    if (blockReason === "disabled") {
      return { error: "이 회사 계정은 비활성화되었습니다. 관리자에게 문의해주세요." };
    }
    if (blockReason === "expired") {
      return { error: "이용기간이 만료되었습니다. 관리자에게 문의해주세요." };
    }
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "로그인에 실패했습니다. 아이디와 비밀번호를 확인해주세요." };
  }

  // 로그인 주소를 하나로 통일한다 — 직원이든 거래처 포털 계정이든 같은
  // /login에서 이메일(또는 회사코드+아이디)+비밀번호로 로그인하고,
  // 로그인에 성공한 뒤에야 "이 계정이 거래처 포털 계정인가"를
  // portal_whoami()로 판단해 보내는 화면을 가른다. 로그인 전에는 입력된
  // 아이디만으로 직원/거래처를 구분할 방법이 없다(이메일 형식이면 둘 다
  // 가능한 입력이라).
  const { data: portalWhoami, error: portalWhoamiError } = await supabase.rpc("portal_whoami");
  if (portalWhoamiError) {
    return { error: "일시적인 오류로 로그인할 수 없습니다. 잠시 후 다시 시도해주세요." };
  }
  if (portalWhoami && portalWhoami.length > 0) {
    redirect("/portal");
  }

  // 위치 QR처럼 로그인 안 된 상태에서 특정 화면으로 바로 들어왔을 때
  // 되돌아갈 경로. 다른 사이트로 튕기는 오픈 리다이렉트를 막기 위해
  // "/"로 시작하고 "//"(스킴 없는 절대 URL)로는 시작하지 않는 내부
  // 경로만 허용한다.
  const nextRaw = String(formData.get("next") ?? "");
  const next = nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/dashboard";

  redirect(next);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
