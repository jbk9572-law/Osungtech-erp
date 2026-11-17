import { requirePlatformAdmin } from "@/lib/require-platform-admin";
import { PageGuide } from "@/components/erp/page-guide";
import { ListPageHeader } from "@/components/erp/page-header";
import { PageNav } from "@/components/erp/page-nav";
import { FailureLogListBody } from "@/components/failure-log-list-body";

const PAGE_SIZE = 200;

// 최근 24시간 요약 — 같은 CODE가 반복되면 사용자 실수가 아니라 설계·배포 문제일 가능성이 높다.
// 이 페이지(최신 200건) 안에서 셈하므로 첫 페이지에서만 쓴다.
function summarizeLast24h(rows: { code: string; created_at: string }[]) {
  const since = Date.now() - 24 * 60 * 60 * 1000;
  const recent = rows.filter((r) => new Date(r.created_at).getTime() >= since);
  const byCode = new Map<string, number>();
  for (const r of recent) byCode.set(r.code, (byCode.get(r.code) ?? 0) + 1);
  return { recentCount: recent.length, topCodes: [...byCode.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3) as [string, number][] };
}

export default async function PlatformFailureLogPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { supabase } = await requirePlatformAdmin();
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Math.floor(Number(pageParam)) || 1);

  // 90일이 지난 기록은 열 때마다 정리한다(무료 DB 용량 보호). 정리가 실패해도 조회는 계속한다.
  const { error: purgeError } = await supabase.rpc("purge_old_failure_logs");
  if (purgeError) console.error("purge_old_failure_logs 실패:", purgeError.message);
  const { data: rows, error } = await supabase.rpc("get_cross_tenant_failure_log", {
    p_limit: PAGE_SIZE,
    p_offset: (page - 1) * PAGE_SIZE,
  });
  const total = Number(rows?.[0]?.total_count ?? 0);

  const { recentCount, topCodes } = page === 1 ? summarizeLast24h(rows ?? []) : { recentCount: 0, topCodes: [] as [string, number][] };

  return (
    <div>
      <ListPageHeader eyebrow="플랫폼 관리" title="실패 로그" />
      <PageGuide>
        사용자가 겪은 모든 DB 저장·수정·삭제 실패를 CODE+한글설명으로 자동으로 모아 보여줍니다(최신순, 한 페이지 200건).
        매입/매출 삭제는 상세 사유로, 나머지는 DB 오류 종류(중복·연결된 데이터·권한·업무 규칙 등)로 분류됩니다. 같은
        실패가 연달아 나면 30초에 한 번만 남기고, 90일이 지난 기록은 자동으로 지워집니다. 같은 CODE가 반복되면 설계
        문제일 가능성이 높으니 눈여겨봐주세요.
      </PageGuide>

      {page === 1 && !!rows?.length && (
        <p className="erp-u-text-base">
          <strong>최근 24시간 실패 {recentCount}건</strong>
          {topCodes.length > 0 && (
            <span className="erp-u-muted">
              {" "}
              · 많이 반복된 CODE: {topCodes.map(([code, n]) => `${code} (${n}건)`).join(", ")}
            </span>
          )}
        </p>
      )}

      {!rows?.length ? (
        <p className="erp-grid-empty">{error ? `조회에 실패했습니다: ${error.message}` : "표시할 실패 로그가 없습니다."}</p>
      ) : (
        <>
          <PageNav basePath="/platform-admin/failure-log" page={page} pageSize={PAGE_SIZE} total={total} />
          <FailureLogListBody rows={rows} />
          <PageNav basePath="/platform-admin/failure-log" page={page} pageSize={PAGE_SIZE} total={total} />
        </>
      )}
    </div>
  );
}
