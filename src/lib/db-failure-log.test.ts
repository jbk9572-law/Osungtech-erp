import { beforeEach, describe, expect, it, vi } from "vitest";
import { classifyDbFailure } from "./classify-db-failure";
import { resetFailureThrottleForTest, withFailureLogging } from "./db-failure-log";

const ORIGIN = "https://example.supabase.co";
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("classifyDbFailure", () => {
  it("중복(23505)을 한글로 설명하고 대상 테이블·id를 뽑는다", () => {
    const f = classifyDbFailure({
      method: "PATCH", resource: "products", query: "id=eq.11111111-2222-3333-4444-555555555555",
      status: 409, body: { code: "23505", message: 'duplicate key value violates unique constraint "x"' },
    });
    expect(f.code).toBe("DB_23505");
    expect(f.messageKo).toContain("중복");
    expect(f.action).toBe("PATCH products");
    expect(f.entityType).toBe("products");
    expect(f.entityId).toBe("11111111-2222-3333-4444-555555555555");
  });
  it("서버 함수가 던진 업무 규칙(P0001)은 그 문구를 요약에 쓴다", () => {
    const f = classifyDbFailure({ method: "POST", resource: "rpc/create_sale_with_items", query: "", status: 400, body: { code: "P0001", message: "불러온 입고 수량을 넘었습니다." } });
    expect(f.action).toBe("rpc create_sale_with_items");
    expect(f.entityType).toBeNull();
    expect(f.messageKo).toContain("불러온 입고 수량을 넘었습니다");
  });
  it("모르는 코드·본문 없음도 로그가 끊기지 않게 분류한다", () => {
    expect(classifyDbFailure({ method: "DELETE", resource: "x", query: "", status: 500, body: null })).toMatchObject({ code: "DB_HTTP_500", messageKo: "서버 오류로 처리하지 못함" });
    expect(classifyDbFailure({ method: "POST", resource: "x", query: "", status: 418, body: { code: "ZZZZZ" } }).messageKo).toContain("분류되지 않은");
  });
});

describe("withFailureLogging", () => {
  beforeEach(() => resetFailureThrottleForTest());

  function setup(response: Response) {
    const calls: { url: string; init?: RequestInit }[] = [];
    const base = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      return url.endsWith("/failure_logs") ? new Response(null, { status: 201 }) : response.clone();
    }) as unknown as typeof fetch;
    return { fetch: withFailureLogging(base), calls };
  }
  const headers = { apikey: "k", Authorization: "Bearer t", "Content-Type": "application/json" };

  it("변경 요청이 실패하면 failure_logs에 남기고 원래 응답은 그대로 돌려준다", async () => {
    const { fetch, calls } = setup(json(409, { code: "23505", message: "dup" }));
    const res = await fetch(`${ORIGIN}/rest/v1/products?id=eq.11111111-2222-3333-4444-555555555555`, { method: "PATCH", headers, body: '{"name":"비밀"}' });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: "23505" });
    const log = calls.find((c) => c.url.endsWith("/rest/v1/failure_logs"));
    expect(log).toBeTruthy();
    const sent = JSON.parse(String(log!.init!.body));
    expect(sent).toMatchObject({ code: "DB_23505", action: "PATCH products", entity_id: "11111111-2222-3333-4444-555555555555" });
    expect(JSON.stringify(sent)).not.toContain("비밀"); // 요청 본문(입력 값)은 기록하지 않는다
    expect(new Headers(log!.init!.headers).get("Authorization")).toBe("Bearer t"); // 사용자 인증으로 남겨 회사 구분이 된다
  });
  it("조회(GET)·성공·인증·로그 테이블 자신·이미 상세 기록하는 삭제 rpc는 남기지 않는다", async () => {
    for (const [method, path, status] of [
      ["GET", "/rest/v1/products", 500], ["POST", "/rest/v1/products", 201], ["POST", "/auth/v1/token", 400],
      ["POST", "/rest/v1/failure_logs", 400], ["POST", "/rest/v1/rpc/delete_sale_with_items", 400], ["POST", "/rest/v1/rpc/delete_purchase_with_items", 400],
    ] as const) {
      const { fetch, calls } = setup(json(status, { code: "P0001", message: "x" }));
      await fetch(`${ORIGIN}${path}`, { method, headers });
      expect(calls.filter((c) => c.url.endsWith("/failure_logs") && c.init?.method === "POST" && c.url !== `${ORIGIN}${path}`), `${method} ${path}`).toHaveLength(0);
    }
  });
  it("같은 실패가 연달아 나도 30초 안에는 한 번만 남긴다", async () => {
    const { fetch, calls } = setup(json(409, { code: "23505", message: "dup" }));
    for (let i = 0; i < 5; i++) await fetch(`${ORIGIN}/rest/v1/products`, { method: "POST", headers });
    expect(calls.filter((c) => c.url.endsWith("/failure_logs"))).toHaveLength(1);
  });
  it("로그 적재가 실패해도 원래 응답에는 영향이 없다", async () => {
    const base = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith("/failure_logs")) throw new Error("log down");
      return json(400, { code: "23502", message: "null" });
    }) as unknown as typeof fetch;
    const res = await withFailureLogging(base)(`${ORIGIN}/rest/v1/products`, { method: "POST", headers });
    expect(res.status).toBe(400);
  });
});
