import { classifyDbFailure } from "@/lib/classify-db-failure";

// 모든 DB 변경 요청의 실패를 failure_logs에 자동으로 남긴다(플랫폼 관리자 > 실패 로그).
// 변경 코드가 63개 파일 777곳이라 호출부마다 로그 코드를 다는 대신, 모든 요청이 지나가는 Supabase 서버 클라이언트의
// fetch 한 곳에 끼운다 — 새 화면이 생겨도 자동으로 잡힌다. 원래 요청의 응답은 그대로 돌려주고(본문은 clone으로만 읽음),
// 로그를 남기다 실패해도 원래 동작에는 영향이 없다. 요청 본문(입력 값)은 개인정보가 섞일 수 있어 기록하지 않는다.

// 호출부가 이미 상세 분류해 직접 남기는 rpc — 중복 기록하지 않는다.
const ALREADY_LOGGED_RPCS = new Set(["delete_sale_with_items", "delete_purchase_with_items"]);

// 같은 실패가 반복되면(저장 버튼 연타, 오류 반복 등) DB를 채우지 않도록 같은 CODE+작업은 30초에 한 번만, 전체는 분당 60건까지만 남긴다.
const SAME_FAILURE_WINDOW_MS = 30_000;
const MAX_PER_MINUTE = 60;
const recent = new Map<string, number>();
let minuteStart = 0;
let minuteCount = 0;

export function resetFailureThrottleForTest() {
  recent.clear();
  minuteStart = 0;
  minuteCount = 0;
}

function allow(key: string, now: number): boolean {
  const last = recent.get(key);
  if (last !== undefined && now - last < SAME_FAILURE_WINDOW_MS) return false;
  if (now - minuteStart >= 60_000) {
    minuteStart = now;
    minuteCount = 0;
  }
  if (minuteCount >= MAX_PER_MINUTE) return false;
  minuteCount += 1;
  recent.set(key, now);
  if (recent.size > 500) {
    for (const [k, t] of recent) if (now - t >= SAME_FAILURE_WINDOW_MS) recent.delete(k);
  }
  return true;
}

function describe(input: Parameters<typeof fetch>[0], init: Parameters<typeof fetch>[1]) {
  const isRequest = typeof Request !== "undefined" && input instanceof Request;
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url);
  const method = (init?.method ?? (isRequest ? (input as Request).method : "GET")).toUpperCase();
  const headers = new Headers(init?.headers ?? (isRequest ? (input as Request).headers : undefined));
  return { url, method, headers };
}

export function withFailureLogging(baseFetch: typeof fetch = fetch): typeof fetch {
  return async (input, init) => {
    const res = await baseFetch(input, init);
    if (res.ok) return res;
    try {
      const { url, method, headers } = describe(input, init);
      if (method === "GET" || method === "HEAD") return res;
      if (!url.pathname.startsWith("/rest/v1/")) return res;
      const resource = url.pathname.slice("/rest/v1/".length);
      if (resource === "failure_logs") return res;
      if (resource.startsWith("rpc/") && ALREADY_LOGGED_RPCS.has(resource.slice(4))) return res;

      const body = (await res.clone().json().catch(() => null)) as Parameters<typeof classifyDbFailure>[0]["body"];
      const failure = classifyDbFailure({ method, resource, query: url.search.replace(/^\?/, ""), status: res.status, body });
      if (!allow(`${failure.code}|${failure.action}`, Date.now())) return res;

      headers.set("Content-Type", "application/json");
      headers.set("Prefer", "return=minimal");
      await baseFetch(`${url.origin}/rest/v1/failure_logs`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          code: failure.code,
          message_ko: failure.messageKo,
          action: failure.action,
          entity_type: failure.entityType,
          entity_id: failure.entityId,
          detail: failure.detail,
          context: { status: res.status, auto: true },
        }),
      });
    } catch {
      // 로그를 남기다 실패해도 원래 요청의 결과는 그대로 돌려준다.
    }
    return res;
  };
}
