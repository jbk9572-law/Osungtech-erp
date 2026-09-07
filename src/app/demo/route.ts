import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// 아이디/비밀번호 입력 없이 곧바로 데모 계정으로 로그인시키는 진입점.
// 미리 만들어둔 데모 계정(설정 > 계정관리에서 "테스트(데모) 계정으로
// 만들기"로 생성, is_demo=true)의 자격증명을 서버 환경변수로만 들고
// 있다가 대신 로그인해주고 /dashboard로 보낸다 — 그 이후 화면은 이미
// DB 레벨로 격리된 데모 데이터만 보고/쓰게 된다(demo_account_isolation
// 마이그레이션 참고). 자격증명이 브라우저로 노출되는 지점은 없다.
export async function GET(request: NextRequest) {
  const email = process.env.DEMO_LOGIN_EMAIL;
  const password = process.env.DEMO_LOGIN_PASSWORD;

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
