import { requirePlatformAdmin } from "@/lib/require-platform-admin";
import { PageGuide } from "@/components/erp/page-guide";
import { ListPageHeader } from "@/components/erp/page-header";
import { formatNumber } from "@/lib/format-number";
import { UsageWidgetPanel } from "@/components/erp/usage-widget-panel";
import { isR2Configured } from "@/lib/r2/client";

type TenantUsageRow = {
  tenant_id: string;
  tenant_name: string;
  email_sent_count: number;
  fax_sent_count: number;
  invoice_issued_count: number;
  alimtalk_sent_count: number;
};

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

  const { data: usageRows } = await supabase.rpc("get_platform_monthly_usage_breakdown");
  const tenantUsage = (usageRows ?? []) as TenantUsageRow[];
  const usageTotals = tenantUsage.reduce(
    (sum, r) => ({
      email: sum.email + r.email_sent_count,
      fax: sum.fax + r.fax_sent_count,
      invoice: sum.invoice + r.invoice_issued_count,
      alimtalk: sum.alimtalk + r.alimtalk_sent_count,
    }),
    { email: 0, fax: 0, invoice: 0, alimtalk: 0 },
  );

  return (
    <div>
      <ListPageHeader eyebrow="플랫폼 관리" title="통계" />
      <PageGuide>플랫폼 전체 테넌트/사용자 현황과 최근 12개월 신규 가입 추이입니다.</PageGuide>

      {error && (
        <p className="erp-grid-empty" style={{ marginTop: "var(--erp-space-4)" }}>
          조회에 실패했습니다: {error.message}
        </p>
      )}

      {stats && (
        <>
          <div className="erp-kpi-row">
            <div className="erp-home-panel erp-kpi-card">
              <div className="erp-kpi-label">전체 테넌트</div>
              <div className="erp-kpi-value">{formatNumber(stats.totalTenants)}개</div>
            </div>
            <div className="erp-home-panel erp-kpi-card">
              <div className="erp-kpi-label">활성 테넌트</div>
              <div className="erp-kpi-value" style={{ color: "var(--erp-primary)" }}>
                {formatNumber(stats.activeTenants)}개
              </div>
            </div>
            <div className="erp-home-panel erp-kpi-card">
              <div className="erp-kpi-label">전체 사용자</div>
              <div className="erp-kpi-value">{formatNumber(stats.totalUsers)}명</div>
            </div>
            <div className="erp-home-panel erp-kpi-card">
              <div className="erp-kpi-label">이번 달 가입</div>
              <div className="erp-kpi-value">
                {formatNumber((monthlySignups.at(-1)?.count ?? 0))}개
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
                          borderRadius: "var(--erp-comm-radius-sm)",
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

      {/* "메일/팩스/알림톡/계산서 전체 발송량도 보여줘야 하고 업체별로도
          볼 수 있어야 한다"는 지적 — 이번 달(KST 기준) 발송량을 전체
          합계(KPI 카드)와 테넌트별 표로 같이 보여준다. 팩스/알림톡은
          아직 실제 발송 API가 없어(migration 189/192 주석) 지금은 항상
          0건으로 보이지만, 나중에 그 기능이 붙으면 이 화면이 자동으로
          채워진다 — 화면을 또 고칠 필요가 없다. */}
      <h2 className="mt-5 mb-2" style={{ fontSize: "var(--erp-font-md)", fontWeight: 700, color: "var(--erp-text)" }}>
        이번 달 테넌트별 발송량
      </h2>
      <div className="erp-kpi-row">
        <div className="erp-home-panel erp-kpi-card">
          <div className="erp-kpi-label">메일 발송</div>
          <div className="erp-kpi-value">{formatNumber(usageTotals.email)}건</div>
        </div>
        <div className="erp-home-panel erp-kpi-card">
          <div className="erp-kpi-label">팩스 발송</div>
          <div className="erp-kpi-value">{formatNumber(usageTotals.fax)}건</div>
        </div>
        <div className="erp-home-panel erp-kpi-card">
          <div className="erp-kpi-label">계산서 발행</div>
          <div className="erp-kpi-value">{formatNumber(usageTotals.invoice)}건</div>
        </div>
        <div className="erp-home-panel erp-kpi-card">
          <div className="erp-kpi-label">알림톡/문자 발송</div>
          <div className="erp-kpi-value">{formatNumber(usageTotals.alimtalk)}건</div>
        </div>
      </div>

      <div className="erp-detail" style={{ marginTop: "var(--erp-space-3)", marginBottom: "var(--erp-space-5)" }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">업체별 발송량</span>
        </div>
        <div className="erp-detail-body" style={{ padding: 0 }}>
          {tenantUsage.length === 0 ? (
            <p className="erp-grid-empty">표시할 테넌트가 없습니다.</p>
          ) : (
            <div className="erp-grid-wrap has-card-view">
              <table className="erp-grid">
                <thead>
                  <tr>
                    <th>업체</th>
                    <th style={{ textAlign: "right" }}>메일</th>
                    <th style={{ textAlign: "right" }}>팩스</th>
                    <th style={{ textAlign: "right" }}>계산서</th>
                    <th style={{ textAlign: "right" }}>알림톡/문자</th>
                  </tr>
                </thead>
                <tbody>
                  {tenantUsage.map((row) => (
                    <tr key={row.tenant_id} style={{ cursor: "default" }}>
                      <td>{row.tenant_name}</td>
                      <td style={{ textAlign: "right" }}>{formatNumber(row.email_sent_count)}</td>
                      <td style={{ textAlign: "right" }}>{formatNumber(row.fax_sent_count)}</td>
                      <td style={{ textAlign: "right" }}>{formatNumber(row.invoice_issued_count)}</td>
                      <td style={{ textAlign: "right" }}>{formatNumber(row.alimtalk_sent_count)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td style={{ fontWeight: 700 }}>합계</td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>{formatNumber(usageTotals.email)}</td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>{formatNumber(usageTotals.fax)}</td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>{formatNumber(usageTotals.invoice)}</td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>{formatNumber(usageTotals.alimtalk)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {tenantUsage.length > 0 && (
            <div className="erp-row-card-list">
              {tenantUsage.map((row) => (
                <div className="erp-row-card" key={row.tenant_id}>
                  <div className="erp-row-card-head">
                    <span className="erp-row-card-partner">{row.tenant_name}</span>
                  </div>
                  <dl className="erp-order-item-fields">
                    <div>
                      <dt>메일</dt>
                      <dd>{formatNumber(row.email_sent_count)}</dd>
                    </div>
                    <div>
                      <dt>팩스</dt>
                      <dd>{formatNumber(row.fax_sent_count)}</dd>
                    </div>
                    <div>
                      <dt>계산서</dt>
                      <dd>{formatNumber(row.invoice_issued_count)}</dd>
                    </div>
                    <div>
                      <dt>알림톡/문자</dt>
                      <dd>{formatNumber(row.alimtalk_sent_count)}</dd>
                    </div>
                  </dl>
                </div>
              ))}
              <div className="erp-row-card-foot" style={{ fontWeight: 700 }}>
                <span>합계</span>
                <span className="erp-row-card-amount" style={{ fontSize: "var(--erp-font-sm)" }}>
                  메일 {formatNumber(usageTotals.email)} · 팩스 {formatNumber(usageTotals.fax)} · 계산서{" "}
                  {formatNumber(usageTotals.invoice)} · 알림톡/문자 {formatNumber(usageTotals.alimtalk)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 예전엔 사이드바(트리메뉴 아래)에 플랫폼 운영자에게만 떠 있던
          "무료플랜 소진율" 위젯 — 일반 업무 화면을 돌아다니는 내내 계속
          보이는 게 아니라, 플랫폼 운영 관련 정보답게 이 통계 화면
          안으로 옮겼다. UsageWidgetPanel 자체가 이미 자기 테두리/배경을
          가진 완결된 블록이라 추가로 카드 테두리로 또 감싸지 않는다
          (개발헌법 3번 — 박스 안에 박스 방지). */}
      <h2 className="mt-5 mb-2" style={{ fontSize: "var(--erp-font-md)", fontWeight: 700, color: "var(--erp-text)" }}>
        인프라 사용량(Supabase · Netlify · 서버)
      </h2>
      {/* R2 저장소/쓰기호출 행은 isR2Configured()가 false면 UsageWidget이
          그냥 행 자체를 숨긴다(테넌트 사이드바 쪽은 이게 맞는 동작 — 일반
          사용자에게 인프라 설정 여부를 알릴 필요가 없다). 하지만 이
          화면은 플랫폼 운영자 전용이라 "왜 안 보이는지"를 직접 알아야
          하는 사람이 보는 화면인데, 아무 설명 없이 행만 사라지면 매번
          "왜 안 나오냐"고 다시 물어야 한다(실제로 반복됨) — 그래서 여기
          에서만 설정 여부를 명시적으로 보여준다. */}
      {!isR2Configured() && (
        <PageGuide tone="warning" className="mb-3">
          <strong>R2 파일 저장소/쓰기호출 행이 안 보이는 이유:</strong> 이 배포(Cloudflare
          Workers)에 R2 연동 환경변수(<code>R2_ACCOUNT_ID</code>, <code>R2_ACCESS_KEY_ID</code>,{" "}
          <code>R2_SECRET_ACCESS_KEY</code>, <code>R2_BUCKET_NAME</code>) 4개가 전부 설정되지
          않았습니다 — 코드 버그가 아니라 아직 연동을 안 한 상태라 위젯이 의도적으로
          숨겨집니다. Cloudflare 대시보드 &gt; Workers &amp; Pages &gt; 이 Worker &gt; Settings &gt;
          Variables and Secrets에서 네 값을 전부 <strong>Secret</strong> 타입으로 추가하세요(일반
          Variable 타입은 wrangler.jsonc에 따로 선언하지 않으면 이 Worker에 실제로 안
          묶입니다 — SUPABASE_SERVICE_ROLE_KEY와 같은 방식으로 Secret으로 넣어야 합니다).
          추가 후에는 재배포 없이 다음 요청부터 바로 반영됩니다.
        </PageGuide>
      )}
      <UsageWidgetPanel />
    </div>
  );
}
