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
      <h1 className="mb-1 erp-h1">플랫폼 관리 &gt; 활동 로그</h1>
      <PageGuide>
        전체 테넌트를 넘나드는 최근 활동 로그입니다(최근 200건). 각 회사가 개별적으로 보는 감사
        로그와 달리, 회사 구분 없이 전체를 훑어볼 때만 씁니다.
      </PageGuide>

      {!rows?.length ? (
        <p className="erp-grid-empty">{error ? `조회에 실패했습니다: ${error.message}` : "표시할 활동 로그가 없습니다."}</p>
      ) : (
        <div className="erp-card-feed">
          {rows.map((r) => (
            <div
              key={r.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "var(--erp-space-5)",
                background: "var(--erp-panel)",
                border: "1px solid var(--erp-comm-border)",
                borderRadius: "var(--erp-comm-radius-row)",
                boxShadow: "var(--erp-comm-shadow-row)",
                padding: "11px 16px",
                flex: "0 0 auto",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: "var(--erp-font-base)", fontWeight: 600, color: "var(--erp-text)" }}>
                  {r.tenant_name ?? "-"}
                  <span style={{ marginLeft: "var(--erp-space-2)" }}>
                    <span className="erp-badge erp-badge-muted">{ACTION_LABELS[r.action] ?? r.action}</span>
                  </span>
                </div>
                <div style={{ fontSize: 11, color: "var(--erp-text-muted)", marginTop: 3 }}>
                  {r.table_name} · {r.actor_name ?? "-"}
                </div>
              </div>
              <div style={{ fontSize: 11, color: "var(--erp-text-muted)", flex: "0 0 auto" }}>
                {new Date(r.created_at).toLocaleString("ko-KR")}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
