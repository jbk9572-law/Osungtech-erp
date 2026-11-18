import { createAdminClient } from "@/lib/supabase/admin";

// 서버 화면 렌더 오류를 server_error_logs 에 남긴다(플랫폼 관리자 > 서버 오류). 운영 빌드는 오류 문구를 지우고
// digest 만 화면에 보여 주므로, 이 기록이 없으면 원인을 알 수 없다. 로그 적재가 실패해도 원래 요청에는 영향이 없다.
// 같은 오류가 반복되면 DB 를 채우지 않도록 같은 digest/문구는 30초에 한 번, 전체는 분당 30건까지만 남긴다.
const WINDOW_MS = 30_000;
const MAX_PER_MINUTE = 30;
const recent = new Map<string, number>();
let minuteStart = 0;
let minuteCount = 0;

function allow(key: string, now: number): boolean {
  const last = recent.get(key);
  if (last !== undefined && now - last < WINDOW_MS) return false;
  if (now - minuteStart >= 60_000) {
    minuteStart = now;
    minuteCount = 0;
  }
  if (minuteCount >= MAX_PER_MINUTE) return false;
  minuteCount += 1;
  recent.set(key, now);
  if (recent.size > 200) {
    for (const [k, t] of recent) if (now - t >= WINDOW_MS) recent.delete(k);
  }
  return true;
}

export async function recordServerError(
  error: unknown,
  ctx: { path: string; routePath: string; routeType: string },
): Promise<void> {
  try {
    const message = error instanceof Error ? error.message : String(error);
    const digest = (error as { digest?: unknown } | null)?.digest;
    if (!allow(`${typeof digest === "string" ? digest : message}|${ctx.routePath}`, Date.now())) return;
    const admin = createAdminClient();
    const { error: insertError } = await admin.from("server_error_logs").insert({
      digest: typeof digest === "string" ? digest : null,
      path: ctx.path.slice(0, 300),
      route_path: ctx.routePath.slice(0, 200),
      route_type: ctx.routeType,
      error_name: error instanceof Error ? error.name : typeof error,
      message: message.slice(0, 2000),
      stack: error instanceof Error ? (error.stack ?? "").slice(0, 6000) : null,
    });
    if (insertError) console.error("server_error_logs 기록 실패:", insertError.message);
  } catch {
    // 기록 실패는 조용히 무시한다.
  }
}

// 30일이 지난 기록을 지울 기준 시각(서버 오류 화면이 열릴 때 정리한다).
export function serverErrorPurgeCutoffIso(): string {
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
}
