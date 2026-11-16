"use server";

import { getUser } from "@/lib/supabase/server";
import { reportServerError } from "@/lib/error-tracking";
import { PERF_BUDGET } from "@/lib/perf-budget";

// 브라우저가 잰 "클릭 → 내용이 보이기까지" 시간을 느림 기록(Sentry)으로 남긴다. 로그인한 사용자만, 숫자·주소만 받는다.
export async function reportSlowNavigation(path: string, ms: number): Promise<void> {
  const user = await getUser();
  if (!user) return;
  if (!Number.isFinite(ms) || ms < PERF_BUDGET.navigationMs || ms > 10 * 60_000) return;
  // 쿼리·식별자(uuid, 숫자)는 빼고 화면 종류만 남긴다 — 같은 화면이 한 묶음으로 보이고 개인 값이 남지 않는다.
  const route = String(path)
    .split("?")[0]
    .slice(0, 120)
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, ":id")
    .replace(/\/\d+(?=\/|$)/g, "/:n");
  await reportServerError(
    Object.assign(new Error(`navigation ${route} took ${Math.round(ms)}ms`), { name: "SlowNavigationWarning" }),
    { route, ms: Math.round(ms) },
  );
}
