import { NextResponse } from "next/server";

// 브라우저가 "이 화면이 CSP(콘텐츠 보안 정책) 위반을 했을 것"이라고 보내는 보고를
// 서버 로그에 남기는 곳. 지금 CSP는 "감시 전용(Report-Only)" 모드라 위반이 있어도
// 화면은 그대로 동작하고, 여기로 보고만 온다 — 이 로그로 어떤 출처를 허용해야
// 하는지 확인한 뒤 강제 모드로 올린다(next.config.ts 참고).
// 누구나(로그인 전 포함) 호출할 수 있는 공개 엔드포인트라 로그 폭주를 막기 위해
// 본문 크기와 분당 기록 수를 제한한다.
const MAX_BODY_BYTES = 8 * 1024;
const MAX_REPORTS_PER_MINUTE = 60;
let windowStart = 0;
let count = 0;

export async function POST(request: Request) {
  const now = Date.now();
  if (now - windowStart > 60_000) {
    windowStart = now;
    count = 0;
  }
  if (++count > MAX_REPORTS_PER_MINUTE) {
    return new NextResponse(null, { status: 204 });
  }

  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) {
    return new NextResponse(null, { status: 413 });
  }
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const report = (parsed["csp-report"] ?? parsed) as Record<string, unknown>;
    console.warn(
      JSON.stringify({
        tag: "cspViolation",
        directive: report["effective-directive"] ?? report["violated-directive"],
        blocked: String(report["blocked-uri"] ?? "").slice(0, 200),
        document: String(report["document-uri"] ?? "").slice(0, 200),
      }),
    );
  } catch {
    // 형식이 이상한 본문은 무시한다.
  }
  return new NextResponse(null, { status: 204 });
}
