import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/require-platform-admin";
import { PageGuide } from "@/components/erp/page-guide";
import { ListPageHeader } from "@/components/erp/page-header";
import { GridBadge } from "@/components/grid/badge";
import { formatKstDateTime } from "@/lib/kst-date";
import { serverErrorPurgeCutoffIso } from "@/lib/server-error-log";
import { PERF_ALERT, PERF_BUDGET } from "@/lib/perf-budget";

const PAGE_SIZE = 100;
const KINDS = [
  { key: "all", label: "전체" },
  { key: "error", label: "서버 오류" },
  { key: "slow_page", label: "느린 서버 화면" },
  { key: "slow_nav", label: "느린 이동(체감)" },
  { key: "client_error", label: "브라우저 오류 화면" },
] as const;
const KIND_LABEL: Record<string, string> = { error: "오류", slow_page: "서버 느림", slow_nav: "이동 느림", client_error: "브라우저" };

type Row = {
  id: string;
  created_at: string;
  kind: string;
  digest: string | null;
  path: string | null;
  route_path: string | null;
  error_name: string | null;
  message: string | null;
  stack: string | null;
  duration_ms: number | null;
  db_calls: number | null;
};

// 화면이 "일시적인 오류로 화면을 불러오지 못했습니다"로 바뀔 때 보이는 digest 번호로 진짜 오류 문구를 찾고,
// 기준(PERF_BUDGET)보다 느렸던 화면·이동을 한 곳에서 본다. 알림은 PERF_ALERT 기준을 넘을 때 플랫폼 관리자에게 푸시로 간다.
export default async function PlatformServerErrorsPage({
  searchParams,
}: {
  searchParams: Promise<{ digest?: string; kind?: string }>;
}) {
  const { supabase, isPlatformAdmin } = await requirePlatformAdmin();
  const { digest, kind: kindParam } = await searchParams;
  if (!isPlatformAdmin) return null;
  const kind = KINDS.some((k) => k.key === kindParam) ? (kindParam as string) : "all";

  // 30일이 지난 기록은 열 때마다 정리한다(무료 DB 용량 보호). 실패해도 조회는 계속한다.
  const { error: purgeError } = await supabase.from("server_error_logs").delete().lt("created_at", serverErrorPurgeCutoffIso());
  if (purgeError) console.error("server_error_logs 정리 실패:", purgeError.message);

  const digestFilter = (digest ?? "").trim();
  let query = supabase
    .from("server_error_logs")
    .select("id, created_at, kind, digest, path, route_path, error_name, message, stack, duration_ms, db_calls")
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);
  if (digestFilter) query = query.eq("digest", digestFilter);
  if (kind !== "all") query = query.eq("kind", kind);
  const { data: rows, error } = await query;

  // 최근 24시간 요약(최대 1000건 안에서 계산).
  const sinceIso = new Date(new Date().getTime() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recent } = await supabase
    .from("server_error_logs")
    .select("kind, route_path, duration_ms")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(1000);
  const count = (k: string) => (recent ?? []).filter((r) => r.kind === k).length;
  const slowByRoute = new Map<string, { n: number; max: number; sum: number }>();
  for (const r of recent ?? []) {
    if (r.kind === "error" || !r.route_path) continue;
    const key = `${r.kind}|${r.route_path}`;
    const cur = slowByRoute.get(key) ?? { n: 0, max: 0, sum: 0 };
    cur.n += 1;
    cur.sum += r.duration_ms ?? 0;
    cur.max = Math.max(cur.max, r.duration_ms ?? 0);
    slowByRoute.set(key, cur);
  }
  const topSlow = [...slowByRoute.entries()].sort((a, b) => b[1].n - a[1].n || b[1].max - a[1].max).slice(0, 5);

  return (
    <div>
      <ListPageHeader eyebrow="플랫폼 관리" title="서버 오류·느린 화면" />
      <PageGuide>
        화면이 &quot;일시적인 오류로 화면을 불러오지 못했습니다&quot;로 바뀔 때 화면에 나온 digest 번호로 실제 오류 문구를 찾을 수 있습니다.
        또 서버에서 {PERF_BUDGET.serverPageMs / 1000}초, 클릭 후 {PERF_BUDGET.navigationMs / 1000}초 이상 걸린 화면을 자동으로 모아 보여줍니다.
        {PERF_ALERT.severeMs / 1000}초 이상 걸리거나 같은 화면이 {PERF_ALERT.repeatWindowMin}분 안에 {PERF_ALERT.repeatCount}번 이상 느리면, 서버 오류는
        {PERF_ALERT.errorRepeatCount}번 이상 나면 플랫폼 관리자에게 푸시 알림이 갑니다(같은 항목은 {PERF_ALERT.cooldownMin}분에 한 번). 같은 항목은
        30초에 한 번만 기록하고, 30일이 지난 기록은 자동으로 지워집니다.
      </PageGuide>

      <p className="erp-u-text-base">
        <strong>최근 24시간</strong> · 서버 오류 {count("error")}건 · 브라우저 오류 화면 {count("client_error")}건 · 느린 서버 화면 {count("slow_page")}건 · 느린 이동 {count("slow_nav")}건
      </p>
      {topSlow.length > 0 && (
        <ul className="erp-u-muted">
          {topSlow.map(([key, v]) => {
            const [k, route] = key.split("|");
            return (
              <li key={key}>
                {KIND_LABEL[k]} · {route} — {v.n}번, 최대 {(v.max / 1000).toFixed(1)}초, 평균 {(v.sum / v.n / 1000).toFixed(1)}초
              </li>
            );
          })}
        </ul>
      )}

      <div>
        {KINDS.map((k) => (
          <Link
            key={k.key}
            href={k.key === "all" ? "/platform-admin/server-errors" : `/platform-admin/server-errors?kind=${k.key}`}
            className={`erp-btn erp-btn-sm${kind === k.key ? " erp-btn-primary" : ""}`}
          >
            {k.label}
          </Link>
        ))}
      </div>
      <form method="get">
        {kind !== "all" && <input type="hidden" name="kind" value={kind} />}
        <input name="digest" autoComplete="off" defaultValue={digestFilter} placeholder="digest 번호로 찾기" className="erp-input" />{" "}
        <button type="submit" className="erp-btn">찾기</button>
      </form>
      {error && <p className="erp-u-text-base">조회에 실패했습니다: {error.message}</p>}
      {!error && (rows ?? []).length === 0 && <p className="erp-u-muted">기록이 없습니다.</p>}
      <div>
        {((rows ?? []) as Row[]).map((r) => (
          <details key={r.id} className="erp-detail">
            <summary>
              <GridBadge tone={r.kind === "error" || r.kind === "client_error" ? "danger" : "warn"}>{KIND_LABEL[r.kind] ?? r.kind}</GridBadge>{" "}
              {formatKstDateTime(r.created_at)} · {r.route_path ?? r.path}
              {r.digest ? ` · digest ${r.digest}` : ""}
              {r.duration_ms != null ? ` · ${(r.duration_ms / 1000).toFixed(1)}초` : ""}
              {r.db_calls != null ? ` · DB ${r.db_calls}번` : ""}
              {r.kind === "error" || r.kind === "client_error" ? ` · ${r.error_name}: ${(r.message ?? "").slice(0, 120)}` : ""}
            </summary>
            <pre className="erp-u-pre-wrap erp-u-break-word">{r.message}{r.stack ? `\n\n${r.stack}` : ""}</pre>
          </details>
        ))}
      </div>
    </div>
  );
}
