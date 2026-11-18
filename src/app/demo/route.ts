import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServerEnv } from "@/lib/server-env";

// 아이디/비밀번호 입력 없이 곧바로 데모 계정으로 로그인시키는 진입점.
// 미리 만들어둔 데모 계정의 자격증명을 서버 환경변수로만 들고 있다가 대신 로그인해주고 /dashboard로 보낸다.
// 데모는 실제 회사 안에 따로 만든 계정이 아니라 **샌드박스 회사**(설정 > 샌드박스)의 계정을 쓴다 — 샌드박스가 회사째
// 분리돼 있어 격리가 확실하고, 초기화·업종별 예시 데이터도 이미 있다. (예전에 만든 is_demo 계정은 계속 동작한다.)
// 자격증명이 브라우저로 노출되는 지점은 없다.
export async function GET(request: NextRequest) {
  const email = getServerEnv("DEMO_LOGIN_EMAIL");
  const password = getServerEnv("DEMO_LOGIN_PASSWORD");

  if (!email || !password) {
    const url = new URL("/login", request.url);
    url.searchParams.set("error", "데모 계정이 아직 설정되지 않았습니다.");
    return NextResponse.redirect(url);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const url = new URL("/login", request.url);
    url.searchParams.set("error", "데모 계정 로그인에 실패했습니다.");
    return NextResponse.redirect(url);
  }

  return NextResponse.redirect(new URL("/dashboard", request.url));
}
