import { creds } from "./env";

// 샌드박스 계정으로 Supabase REST(RPC)를 직접 호출하는 도우미 — 화면을 거치지 않고
// 테스트 데이터를 만들고 지우는 데 쓴다. 회사 분리(RLS) 때문에 이 계정으로는 샌드박스
// 회사의 데이터만 보이고 바뀐다.
export type SandboxApi = Awaited<ReturnType<typeof createSandboxApi>>;

export async function createSandboxApi() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  if (!url || !anon) throw new Error("NEXT_PUBLIC_SUPABASE_URL/ANON_KEY 환경변수가 필요합니다.");
  const { email, password } = creds();

  const loginRes = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anon, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const login = (await loginRes.json()) as { access_token?: string; user?: { id: string } };
  if (!login.access_token) throw new Error("샌드박스 API 로그인에 실패했습니다.");
  const token = login.access_token;
  const userId = login.user!.id;

  async function rest<T = unknown>(path: string, init: RequestInit = {}) {
    const res = await fetch(`${url}/rest/v1/${path}`, {
      ...init,
      headers: { apikey: anon, Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    });
    const text = await res.text();
    let body: unknown = text;
    try { body = JSON.parse(text); } catch { /* 본문이 없는 응답(204) */ }
    return { status: res.status, body: body as T };
  }
  const rpc = <T = unknown>(fn: string, args: Record<string, unknown>) =>
    rest<T>(`rpc/${fn}`, { method: "POST", body: JSON.stringify(args) });

  // 샌드박스의 기본 거래처/매입처/창고 하나씩.
  const first = async (table: string) => {
    const r = await rest<{ id: string }[]>(`${table}?select=id&limit=1`);
    if (!r.body[0]) throw new Error(`샌드박스에 ${table} 데이터가 없습니다.`);
    return r.body[0].id;
  };

  // 테스트 전용 품목 하나를 계속 재사용한다. 공용 샌드박스 품목은 다른 거래의 재고가
  // 섞여 있어 "이 매출이 이 매입에 연결된다" 같은 결과가 때마다 달라진다 — 이 품목은
  // 테스트가 끝날 때 거래를 모두 지우므로 재고 기록이 비어 있어 결과가 항상 같다.
  async function ensureTestProduct(): Promise<string> {
    const sku = "E2E-FIXED";
    const found = await rest<{ id: string }[]>(`products?select=id&sku=eq.${sku}&limit=1`);
    if (Array.isArray(found.body) && found.body[0]) return found.body[0].id;
    const created = await rest<{ id: string }[]>("products", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ sku, name: "[e2e] 테스트 전용 품목", unit: "EA", price: 300, cost: 100 }),
    });
    if (created.status !== 201 || !created.body[0]) {
      throw new Error(`테스트 품목 생성 실패: ${created.status} ${JSON.stringify(created.body)}`);
    }
    return created.body[0].id;
  }

  const ids = {
    customer: await first("customers"),
    supplier: await first("suppliers"),
    warehouse: await first("warehouses"),
    product: await ensureTestProduct(),
  };

  return { rest, rpc, userId, ids };
}

/** 한국시간 기준 오늘(YYYY-MM-DD)에서 며칠 더한 날짜. */
export function kstDate(offsetDays = 0): string {
  const kst = new Date(Date.now() + 9 * 3600 * 1000 + offsetDays * 86400 * 1000);
  return kst.toISOString().slice(0, 10);
}
