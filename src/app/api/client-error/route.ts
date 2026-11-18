import { NextResponse } from "next/server";
import { recordClientError } from "@/lib/server-error-log";

// 브라우저의 오류 화면(error.tsx)이 "이 오류가 났다"고 보내는 보고를 서버 오류 기록에 남기는 곳.
// 로그인 화면에서 나는 오류도 받아야 해서 로그인 전에도 호출 가능한 공개 경로다 — 그래서 본문 크기·분당 건수를 제한하고
// 값은 짧게 잘라 저장한다(기록 자체는 lib/server-error-log.ts 에서 같은 내용 30초 1회로 한 번 더 거른다).
const MAX_BODY_BYTES = 4 * 1024;
const MAX_PER_MINUTE = 30;
let windowStart = 0;
let count = 0;

export async function POST(request: Request) {
  const now = Date.now();
  if (now - windowStart > 60_000) {
    windowStart = now;
    count = 0;
  }
  if (++count > MAX_PER_MINUTE) return new NextResponse(null, { status: 204 });

  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return new NextResponse(null, { status: 413 });
  try {
    const body = JSON.parse(text) as { message?: unknown; digest?: unknown; path?: unknown };
    await recordClientError({
      message: typeof body.message === "string" ? body.message : "(메시지 없음)",
      digest: typeof body.digest === "string" ? body.digest : undefined,
      path: typeof body.path === "string" ? body.path : undefined,
      userAgent: request.headers.get("user-agent") ?? undefined,
    });
  } catch {
    // 형식이 이상한 본문은 무시한다.
  }
  return new NextResponse(null, { status: 204 });
}
