// 점검 모드 — 서버 입구(proxy.ts)에서 모든 요청을 확인한다.
// 예전엔 (dashboard)/layout.tsx에서만 확인해서, 이미 열어 둔 화면 안의 이동·저장 요청과 거래처 포털은 막히지 않았다.

export type MaintenanceFlag = { on: boolean; message: string | null };

const FLAG_TTL_MS = 5_000;
let cached: { flag: MaintenanceFlag; at: number } | null = null;

export function resetMaintenanceCacheForTest() {
  cached = null;
}

// 점검 여부 한 번 조회(공개 값이라 anon 키로 충분). 5초 동안은 서버 안에서 재사용해 평소 DB 부담을 거의 늘리지 않는다.
// 조회가 실패하면 "점검 아님"으로 두어 DB 순단 때문에 모두를 내쫓지 않는다.
export async function getMaintenanceFlag(now = Date.now()): Promise<MaintenanceFlag> {
  if (cached && now - cached.at < FLAG_TTL_MS) return cached.flag;
  let flag: MaintenanceFlag = { on: false, message: null };
  try {
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/get_maintenance_flag`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: "{}",
      cache: "no-store",
    });
    if (res.ok) {
      const rows = (await res.json()) as { maintenance_mode: boolean; maintenance_message: string | null }[];
      const row = rows[0];
      if (row) flag = { on: !!row.maintenance_mode, message: row.maintenance_message ?? null };
    }
  } catch {
    // 조회 실패는 점검 아님으로 처리
  }
  cached = { flag, at: now };
  return flag;
}

export type MaintenanceDecision = "allow" | "page" | "fetch" | "action";

// 점검 중일 때 이 요청을 어떻게 처리할지.
//  - page: 화면 요청 → 점검 안내 화면(503)으로 바꿔서 보여 줌
//  - fetch: 화면 이동용 데이터 요청(RSC) → 503, 브라우저가 알아서 전체 새로고침해 안내 화면을 보게 됨
//  - action: 저장·삭제 같은 서버 요청 → 503으로 거절(점검 중에는 데이터가 바뀌면 안 됨)
export function decideMaintenance(input: {
  on: boolean;
  isPlatformAdmin: boolean;
  pathname: string;
  headers: { get(name: string): string | null };
}): MaintenanceDecision {
  if (!input.on || input.isPlatformAdmin) return "allow";
  const p = input.pathname;
  // 안내 화면 자신, 로그인, 크론(자체 비밀키로 인증)은 점검 중에도 열어 둔다.
  if (p === "/maintenance" || p === "/login" || p.startsWith("/login/") || p === "/auth" || p.startsWith("/auth/")) return "allow";
  if (p === "/api/cron" || p.startsWith("/api/cron/") || p === "/api/csp-report") return "allow";
  if (input.headers.get("next-action")) return "action";
  if (input.headers.get("rsc")) return "fetch";
  return "page";
}
