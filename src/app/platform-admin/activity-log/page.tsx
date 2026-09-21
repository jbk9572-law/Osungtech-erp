import { requirePlatformAdmin } from "@/lib/require-platform-admin";
import { PageGuide } from "@/components/erp/page-guide";

const ACTION_LABELS: Record<string, string> = {
  insert: "등록",
  update: "수정",
  delete: "삭제",
};

export default async function PlatformActivityLogPage() {
  const { supabase } = await requirePlatformAdmin();

  const { data: rows, error } = await supabase.rpc("get_cross_tenant_activity_log", { p_limit: 200 });

  return (
    <div>
      <h1 className="mb-1 text-lg font-bold text-[var(--erp-text)]">플랫폼 관리 &gt; 활동 로그</h1>
      <PageGuide>
        전체 테넌트를 넘나드는 최근 활동 로그입니다(최근 200건). 각 회사가 개별적으로 보는 감사
        로그와 달리, 회사 구분 없이 전체를 훑어볼 때만 씁니다.
      </PageGuide>

      <div className="erp-grid-wrap">
        <table className="erp-grid">
          <thead>
            <tr>
              <th style={{ width: 160 }}>회사</th>
              <th>테이블</th>
              <th style={{ width: 90 }}>동작</th>
              <th>처리자</th>
              <th style={{ width: 160 }}>시각</th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((r) => (
              <tr key={r.id}>
                <td>{r.tenant_name ?? "-"}</td>
                <td style={{ color: "var(--erp-text-muted)" }}>{r.table_name}</td>
                <td>{ACTION_LABELS[r.action] ?? r.action}</td>
                <td>{r.actor_name ?? "-"}</td>
                <td>{new Date(r.created_at).toLocaleString("ko-KR")}</td>
              </tr>
            ))}
            {!rows?.length && (
              <tr>
                <td colSpan={5} className="erp-grid-empty">
                  {error ? `조회에 실패했습니다: ${error.message}` : "표시할 활동 로그가 없습니다."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
