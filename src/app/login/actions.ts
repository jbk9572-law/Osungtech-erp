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

  // "admin"처럼 이메일 형식이 아니면 아이디로 보고, DB에 등록된 이메일을
  // 찾아서 그 이메일로 로그인한다(Supabase Auth 자체는 이메일 기반이라
  // 아이디 로그인을 직접 지원하지 않는다). 직원 아이디는 회사(테넌트)별로만
  // 유니크해서(migration 134) 회사코드가 있어야 어느 회사 계정인지 알 수
  // 있지만, 거래처 포털 계정 아이디는 회사코드 없이 전역에서 유니크하다
  // (migration 162) — 그래서 둘 다 시도해보고 먼저 맞는 쪽을 쓴다.
  let email = loginId;
  if (!loginId.includes("@")) {
    // get_email_for_username/get_portal_email_for_username은 로그인 전
    // (비로그인/anon) 상태에서 호출돼야 하는데, anon에게 직접 실행 권한을
    // 주면 앱을 거치지 않고 공개된 anon key만으로 REST API를 직접 두드려
    // 아이디 존재 여부/이메일을 무제한 조회(계정 목록 수집)할 수 있다.
    // 그래서 이 함수들은 service_role에게만 실행 권한이 있고(migration
    // 75/162), 서버 액션 안에서 관리자 클라이언트로만 호출한다.
    let admin;
    try {
      admin = createAdminClient();
    } catch {
      return { error: "일시적인 오류로 로그인할 수 없습니다. 잠시 후 다시 시도해주세요." };
    }

    if (companyCode) {
      // 회사코드를 입력했으면 직원/거래처 포털 양쪽을 동시에 조회한다 —
      // 포털 계정은 회사코드를 안 쓰지만, 따로 기다리면 왕복이 늘어나니
      // 같이 보낸다(클라우드플레어 Workers에서 로그인마다 왕복 하나씩
      // 아낀다).
      const [
        { data: portalEmail, error: portalLookupError },
        { data: resolvedEmail, error: lookupError },
        { data: blockReason, error: blockCheckError },
      ] = await Promise.all([
        admin.rpc("get_portal_email_for_username", { p_username: loginId }),
        admin.rpc("get_email_for_username", { p_slug: companyCode, p_username: loginId }),
        admin.rpc("get_login_block_reason", { p_slug: companyCode, p_username: loginId }),
      ]);

      if (portalLookupError || lookupError || blockCheckError) {
        return { error: "일시적인 오류로 로그인할 수 없습니다. 잠시 후 다시 시도해주세요." };
      }

      if (portalEmail) {
        email = portalEmail;
      } else if (resolvedEmail) {
        email = resolvedEmail;
        // 플랫폼 관리자가 회사(테넌트)를 비활성화했거나 이용기간이
        // 지났으면, 비밀번호가 맞아도 로그인 자체를 막아야 한다 — 아래
        // signInWithPassword는 그 상태를 모르므로 여기서 먼저 확인한다.
        if (blockReason === "disabled") {
          return { error: "이 회사 계정은 비활성화되었습니다. 관리자에게 문의해주세요." };
        }
        if (blockReason === "expired") {
          return { error: "이용기간이 만료되었습니다. 관리자에게 문의해주세요." };
        }
      } else {
        return { error: "회사코드 또는 아이디가 올바르지 않습니다." };
      }
    } else {
      // 회사코드가 없으면 직원 로그인은 애초에 불가능하므로(테넌트를
      // 특정할 수 없음) 거래처 포털 계정 아이디로만 시도한다.
      const { data: portalEmail, error: portalLookupError } = await admin.rpc("get_portal_email_for_username", {
        p_username: loginId,
      });
      if (portalLookupError) {
        return { error: "일시적인 오류로 로그인할 수 없습니다. 잠시 후 다시 시도해주세요." };
      }
      if (!portalEmail) {
        return { error: "회사코드를 입력해주세요." };
      }
      email = portalEmail;
    }
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "로그인에 실패했습니다. 아이디와 비밀번호를 확인해주세요." };
  }

  // 로그인 주소를 하나로 통일한다 — 직원이든 거래처/업체(하청) 포털
  // 계정이든 같은 /login에서 이메일(또는 회사코드+아이디)+비밀번호로
  // 로그인하고, 로그인에 성공한 뒤에야 "이 계정이 포털 계정인가, 어느
  // 종류인가"를 portal_identity()로 판단해 보내는 화면을 가른다(거래처는
  // /portal/orders, 업체는 /portal/assignments — 실제 분기는 포털
  // 레이아웃이 한다). 로그인 전에는 입력된 아이디만으로 직원/포털 종류를
  // 구분할 방법이 없다(이메일 형식이면 둘 다 가능한 입력이라).
  const { data: portalIdentity, error: portalIdentityError } = await supabase.rpc("portal_identity");
  if (portalIdentityError) {
    return { error: "일시적인 오류로 로그인할 수 없습니다. 잠시 후 다시 시도해주세요." };
  }
  if (portalIdentity && portalIdentity.length > 0) {
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
