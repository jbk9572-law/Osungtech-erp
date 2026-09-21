import { requirePlatformAdmin } from "@/lib/require-platform-admin";
import { PageGuide } from "@/components/erp/page-guide";

type PlatformStats = {
  totalTenants: number;
  activeTenants: number;
  totalUsers: number;
  monthlySignups: { month: string; count: number }[];
};

export default async function PlatformStatsPage() {
  const { supabase } = await requirePlatformAdmin();

  const { data, error } = await supabase.rpc("get_platform_stats");
  const stats = data as PlatformStats | null;
  const monthlySignups = stats?.monthlySignups ?? [];
  const maxCount = Math.max(1, ...monthlySignups.map((m) => m.count));

  return (
    <div>
      <h1 className="mb-1 text-lg font-bold text-[var(--erp-text)]">플랫폼 관리 &gt; 통계</h1>
      <PageGuide>플랫폼 전체 테넌트/사용자 현황과 최근 12개월 신규 가입 추이입니다.</PageGuide>

      {error && (
        <p className="erp-grid-empty" style={{ marginTop: 12 }}>
          조회에 실패했습니다: {error.message}
        </p>
      )}

      {stats && (
        <>
          <div className="erp-kpi-row">
            <div className="erp-home-panel" style={{ padding: "10px 12px" }}>
              <div style={{ fontSize: 11, color: "var(--erp-text-muted)", fontWeight: 600, marginBottom: 6 }}>
                전체 테넌트
              </div>
              <div style={{ fontSize: 17, fontWeight: 700 }}>{stats.totalTenants.toLocaleString()}개</div>
            </div>
            <div className="erp-home-panel" style={{ padding: "10px 12px" }}>
              <div style={{ fontSize: 11, color: "var(--erp-text-muted)", fontWeight: 600, marginBottom: 6 }}>
                활성 테넌트
              </div>
              <div style={{ fontSize: 17, fontWeight: 700, color: "var(--erp-primary)" }}>
                {stats.activeTenants.toLocaleString()}개
              </div>
            </div>
            <div className="erp-home-panel" style={{ padding: "10px 12px" }}>
              <div style={{ fontSize: 11, color: "var(--erp-text-muted)", fontWeight: 600, marginBottom: 6 }}>
                전체 사용자
              </div>
              <div style={{ fontSize: 17, fontWeight: 700 }}>{stats.totalUsers.toLocaleString()}명</div>
            </div>
            <div className="erp-home-panel" style={{ padding: "10px 12px" }}>
              <div style={{ fontSize: 11, color: "var(--erp-text-muted)", fontWeight: 600, marginBottom: 6 }}>
                이번 달 가입
              </div>
              <div style={{ fontSize: 17, fontWeight: 700 }}>
                {(monthlySignups.at(-1)?.count ?? 0).toLocaleString()}개
              </div>
            </div>
          </div>

          <div className="erp-detail" style={{ marginTop: 0 }}>
            <div className="erp-detail-tabs">
              <span className="erp-detail-tab active">최근 12개월 신규 테넌트 가입</span>
            </div>
            <div className="erp-detail-body">
              {monthlySignups.length ? (
                <div className="flex flex-col gap-2">
                  {monthlySignups.map((m) => (
                    <div key={m.month} className="flex items-center gap-2" style={{ fontSize: 12 }}>
                      <span style={{ width: 56, color: "var(--erp-text-muted)", flexShrink: 0 }}>{m.month}</span>
                      <div
                        style={{
                          flex: 1,
                          background: "var(--erp-bg-subtle)",
                          borderRadius: 2,
                          overflow: "hidden",
                          height: 16,
                        }}
                      >
                        <div
                          style={{
                            width: `${(m.count / maxCount) * 100}%`,
                            background: "var(--erp-primary)",
                            height: "100%",
                            minWidth: m.count > 0 ? 4 : 0,
                          }}
                        />
                      </div>
                      <span style={{ width: 32, textAlign: "right", flexShrink: 0 }}>{m.count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="erp-grid-empty">최근 12개월간 신규 가입이 없습니다.</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
