"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerEnv } from "@/lib/server-env";
import { isDisposableEmail } from "@/lib/disposable-email-domains";
import type { FormState } from "@/components/form-message";

// 짧은 시간에 같은 IP에서 몇 번까지 가입 시도를 허용할지. 클라우드플레어
// WAF rate-limit 규칙(엣지, 대시보드 설정)이 1차 방어선이고 이건 그걸
// 보완하는 앱 레벨 2차 방어라 느슨하게 잡아도 된다 — 너무 빡빡하면 같은
// 사무실/카페 공용 IP를 쓰는 정상 사용자들이 서로 막힐 수 있다.
const RATE_LIMIT_WINDOW_MINUTES = 60;
const RATE_LIMIT_MAX_ATTEMPTS = 10;

function getClientIp(h: Headers): string {
  // cf-connecting-ip: 클라우드플레어가 프록시 단계에서 붙여주는, 스푸핑
  // 불가능한 실제 접속 IP(엣지 레벨에서 덮어써서 클라이언트가 위조 불가).
  // x-forwarded-for는 로컬 개발/클라우드플레어가 아닌 환경을 위한 대체값.
  return (
    h.get("cf-connecting-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const secret = getServerEnv("TURNSTILE_SECRET_KEY");
  // 아직 클라우드플레어 Turnstile 사이트를 발급받기 전(TURNSTILE_SECRET_KEY
  // 미설정)이면 이 단계는 건너뛴다 — 나머지 방어(허니팟/이메일 차단/
  // 레이트리밋)만으로 우선 공개하고, 키가 준비되면 자동으로 켜진다.
  if (!secret) return true;
  if (!token) return false;

  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    // 클라우드플레어 검증 API 자체가 실패하면(네트워크 문제 등) 정상
    // 사용자를 막지 않는 쪽을 택한다 — 다른 방어선이 여전히 살아있다.
    return true;
  }
}

export async function signupTenant(_prevState: FormState, formData: FormData): Promise<FormState> {
  // 허니팟: 화면에는 CSS로 숨겨진 입력칸이라 사람은 절대 채우지 않는다.
  // 값이 있으면 미숙한 자동가입 봇으로 간주하고, 봇에게 실패 이유를
  // 알려주지 않기 위해 성공한 것처럼 보이는 일반 에러만 돌려준다.
  const honeypot = String(formData.get("website") ?? "").trim();
  if (honeypot) {
    return { error: "가입 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요." };
  }

  const companyName = String(formData.get("companyName") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  const username = String(formData.get("username") ?? "").trim();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const contactEmail = String(formData.get("contactEmail") ?? "").trim().toLowerCase();
  const turnstileToken = String(formData.get("cf-turnstile-response") ?? "");

  if (!companyName || !slug || !username || !fullName || !password || !contactEmail) {
    return { error: "모든 항목을 입력해주세요." };
  }
  if (!/^[a-z0-9-]{2,32}$/.test(slug)) {
    return { error: "회사코드는 영문 소문자/숫자/하이픈(2~32자)만 사용할 수 있습니다." };
  }
  if (!/^[a-zA-Z0-9_.-]{2,32}$/.test(username)) {
    return { error: "아이디는 영문/숫자/일부 기호(2~32자)만 사용할 수 있습니다." };
  }
  if (password.length < 6) {
    return { error: "비밀번호는 6자 이상이어야 합니다." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    return { error: "올바른 이메일 형식이 아닙니다." };
  }
  if (isDisposableEmail(contactEmail)) {
    return { error: "일회용 이메일 주소는 가입에 사용할 수 없습니다. 실제 사용하는 이메일을 입력해주세요." };
  }

  const h = await headers();
  const ip = getClientIp(h);

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "서버 초기화에 실패했습니다." };
  }

  // 오래된 기록 청소 + 최근 시도 횟수 확인을 한 번에 — 별도 배치 없이
  // 요청이 들어올 때마다 창 밖 기록을 지운다. 청소/기록 자체는 레이트리밋을
  // 보조하는 부가 동작이라 실패해도 가입 자체를 막지는 않는다(로그만 남김).
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60_000).toISOString();
  const { error: cleanupError } = await admin.from("signup_attempts").delete().lt("created_at", windowStart);
  if (cleanupError) console.error("signup_attempts cleanup failed:", cleanupError.message);

  const { count } = await admin
    .from("signup_attempts")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .gte("created_at", windowStart);
  if ((count ?? 0) >= RATE_LIMIT_MAX_ATTEMPTS) {
    return { error: "잠시 후 다시 시도해주세요." };
  }

  const { error: attemptError } = await admin.from("signup_attempts").insert({ ip });
  if (attemptError) console.error("signup_attempts insert failed:", attemptError.message);

  const turnstileOk = await verifyTurnstile(turnstileToken, ip);
  if (!turnstileOk) {
    return { error: "자동가입 방지 확인에 실패했습니다. 다시 시도해주세요." };
  }

  const { data: existingTenant } = await admin.from("tenants").select("id").eq("slug", slug).maybeSingle();
  if (existingTenant) {
    return { error: "이미 사용 중인 회사코드입니다. 다른 값을 입력해주세요." };
  }

  const email = `${username}@${slug}.elvonix.local`;
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, username, new_tenant_name: companyName, new_tenant_slug: slug },
  });
  if (error || !created.user) {
    const isDuplicate = error?.message?.toLowerCase().includes("already");
    return { error: isDuplicate ? "이미 존재하는 아이디입니다." : (error?.message ?? "계정 생성에 실패했습니다.") };
  }

  const { error: profileError } = await admin.from("profiles").update({ role: "admin" }).eq("id", created.user.id);
  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: `계정 설정에 실패해 가입을 취소했습니다: ${profileError.message}` };
  }

  const { error: tenantError } = await admin.from("tenants").update({ plan: "trial", contact_email: contactEmail }).eq("slug", slug);
  if (tenantError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: `가입 처리에 실패했습니다: ${tenantError.message}` };
  }

  return { redirectTo: `/login?next=/dashboard&signupCompanyCode=${encodeURIComponent(slug)}&signupUsername=${encodeURIComponent(username)}` };
}
