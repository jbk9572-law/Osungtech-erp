import { requirePlatformAdmin } from "@/lib/require-platform-admin";
import { PageGuide } from "@/components/erp/page-guide";
import { ListPageHeader } from "@/components/erp/page-header";
import { formatKstDateTime } from "@/lib/kst-date";
import { serverErrorPurgeCutoffIso } from "@/lib/server-error-log";

const PAGE_SIZE = 100;

// 화면에 "일시적인 오류로 화면을 불러오지 못했습니다"가 뜰 때 함께 보이는 digest 번호로 진짜 오류 문구를 찾는다.
export default async function PlatformServerErrorsPage({ searchParams }: { searchParams: Promise<{ digest?: string }> }) {
  const { supabase, isPlatformAdmin } = await requirePlatformAdmin();
  const { digest } = await searchParams;
  if (!isPlatformAdmin) return null;

  // 30일이 지난 기록은 열 때마다 정리한다(무료 DB 용량 보호). 실패해도 조회는 계속한다.
  const { error: purgeError } = await supabase.from("server_error_logs").delete().lt("created_at", serverErrorPurgeCutoffIso());
  if (purgeError) console.error("server_error_logs 정리 실패:", purgeError.message);

  let query = supabase
    .from("server_error_logs")
    .select("id, created_at, digest, path, route_path, error_name, message, stack")
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);
  const digestFilter = (digest ?? "").trim();
  if (digestFilter) query = query.eq("digest", digestFilter);
  const { data: rows, error } = await query;

  return (
    <div>
      <ListPageHeader eyebrow="플랫폼 관리" title="서버 오류" />
      <PageGuide>
        화면이 &quot;일시적인 오류로 화면을 불러오지 못했습니다&quot;로 바뀔 때, 화면에 나온 digest 번호로 실제 오류 문구를 찾을 수
        있습니다(운영 환경은 화면에 문구를 숨깁니다). 같은 오류는 30초에 한 번만 남기고, 30일이 지난 기록은 자동으로 지워집니다.
      </PageGuide>
      <form method="get">
        <input name="digest" autoComplete="off" defaultValue={digestFilter} placeholder="digest 번호로 찾기" className="erp-input" />{" "}
        <button type="submit" className="erp-btn">찾기</button>
      </form>
      {error && <p className="erp-u-text-base">조회에 실패했습니다: {error.message}</p>}
      {!error && (rows ?? []).length === 0 && <p className="erp-u-muted">기록된 서버 오류가 없습니다.</p>}
      <div>
        {(rows ?? []).map((r) => (
          <details key={r.id} className="erp-detail">
            <summary>
              {formatKstDateTime(r.created_at)} · {r.route_path ?? r.path} · digest {r.digest ?? "-"} · {r.error_name}: {(r.message ?? "").slice(0, 120)}
            </summary>
            <pre className="erp-u-pre-wrap erp-u-break-word">{r.message}{"\n\n"}{r.stack}</pre>
          </details>
        ))}
      </div>
    </div>
  );
}
