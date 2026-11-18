import { createAdminClient } from "@/lib/supabase/admin";
import { PERF_ALERT } from "@/lib/perf-budget";

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

// ── 느린 화면·느린 이동 기록 + 플랫폼 관리자 알림 ─────────────────────────────
// 서버 오류와 같은 테이블(server_error_logs)에 kind 로 구분해 남긴다. 알림은 PERF_ALERT 기준을 넘을 때만 — 같은 항목은 쿨다운 동안 1번.
const lastAlertAt = new Map<string, number>();

async function alertPlatformAdmins(admin: ReturnType<typeof createAdminClient>, key: string, title: string, body: string): Promise<void> {
  const now = Date.now();
  if (now - (lastAlertAt.get(key) ?? 0) < PERF_ALERT.cooldownMin * 60_000) return;
  lastAlertAt.set(key, now);
  if (lastAlertAt.size > 200) {
    for (const [k, t] of lastAlertAt) if (now - t >= PERF_ALERT.cooldownMin * 60_000) lastAlertAt.delete(k);
  }
  const { data: admins } = await admin.from("platform_admins").select("user_id").limit(50);
  const ids = (admins ?? []).map((a) => a.user_id);
  if (ids.length === 0) return;
  const { data: profiles } = await admin.from("profiles").select("id, tenant_id, is_demo").in("id", ids);
  const byTenant = new Map<string, { isDemo: boolean; userIds: string[] }>();
  for (const p of profiles ?? []) {
    if (!p.tenant_id) continue;
    const g = byTenant.get(p.tenant_id) ?? { isDemo: p.is_demo ?? false, userIds: [] };
    g.userIds.push(p.id);
    byTenant.set(p.tenant_id, g);
  }
  // web-push 는 Node 전용이라 계측 파일(instrumentation)이 엣지용으로도 묶일 때 깨지지 않게 필요할 때만 불러온다.
  const { notifyForTenant } = await import("@/lib/notify");
  for (const [tenantId, g] of byTenant) {
    await notifyForTenant({
      tenantId,
      isDemo: g.isDemo,
      userIds: g.userIds,
      type: "platform_perf",
      title,
      body,
      url: "/platform-admin/server-errors",
    });
  }
}

async function countRecent(admin: ReturnType<typeof createAdminClient>, kind: string, route: string, minutes: number): Promise<number> {
  const since = new Date(Date.now() - minutes * 60_000).toISOString();
  const { count } = await admin
    .from("server_error_logs")
    .select("id", { count: "exact", head: true })
    .eq("kind", kind)
    .eq("route_path", route)
    .gte("created_at", since);
  return count ?? 0;
}

export async function recordPerfEvent(ev: {
  kind: "slow_page" | "slow_nav";
  route: string;
  durationMs: number;
  dbCalls?: number;
  dbMs?: number;
}): Promise<void> {
  try {
    if (!allow(`${ev.kind}|${ev.route}`, Date.now())) return;
    const admin = createAdminClient();
    const label = ev.kind === "slow_page" ? "서버 화면" : "화면 이동";
    const { error } = await admin.from("server_error_logs").insert({
      kind: ev.kind,
      route_path: ev.route.slice(0, 200),
      error_name: ev.kind === "slow_page" ? "SlowPage" : "SlowNavigation",
      message: `${label} ${ev.route} ${(ev.durationMs / 1000).toFixed(1)}초${ev.dbCalls != null ? ` (DB ${ev.dbCalls}번)` : ""}`,
      duration_ms: Math.round(ev.durationMs),
      db_calls: ev.dbCalls ?? null,
      db_ms: ev.dbMs ?? null,
    });
    if (error) {
      console.error("server_error_logs(느림) 기록 실패:", error.message);
      return;
    }
    const severe = ev.durationMs >= PERF_ALERT.severeMs;
    const repeated = !severe && (await countRecent(admin, ev.kind, ev.route, PERF_ALERT.repeatWindowMin)) >= PERF_ALERT.repeatCount;
    if (severe || repeated) {
      await alertPlatformAdmins(
        admin,
        `${ev.kind}|${ev.route}`,
        severe ? `${label}이(가) ${(ev.durationMs / 1000).toFixed(0)}초 걸렸습니다` : `${label}이(가) 계속 느립니다`,
        `${ev.route} — ${severe ? "기준 초과" : `${PERF_ALERT.repeatWindowMin}분 안에 ${PERF_ALERT.repeatCount}번 이상`}. 플랫폼 관리자 > 서버 오류에서 확인하세요.`,
      );
    }
  } catch {
    // 기록·알림 실패는 조용히 무시한다.
  }
}

// 서버 화면 오류가 짧은 시간에 반복되면 알린다(recordServerError 뒤에 호출).
export async function alertIfErrorsRepeat(routePath: string): Promise<void> {
  try {
    const admin = createAdminClient();
    if ((await countRecent(admin, "error", routePath.slice(0, 200), PERF_ALERT.repeatWindowMin)) >= PERF_ALERT.errorRepeatCount) {
      await alertPlatformAdmins(
        admin,
        `error|${routePath}`,
        "서버 화면 오류가 반복되고 있습니다",
        `${routePath} — ${PERF_ALERT.repeatWindowMin}분 안에 ${PERF_ALERT.errorRepeatCount}번 이상. 플랫폼 관리자 > 서버 오류에서 문구를 확인하세요.`,
      );
    }
  } catch {
    // 조용히 무시
  }
}
