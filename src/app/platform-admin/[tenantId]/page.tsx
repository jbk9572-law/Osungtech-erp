import { notFound } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { EditCompanyForm } from "@/components/edit-company-form";
import { TenantStatusControls } from "@/components/tenant-status-controls";
import { TenantPointsPanel } from "@/components/tenant-points-panel";
import { ResetTenantUserPasswordForm } from "@/components/reset-tenant-user-password-form";
import { CreateTenantDemoAccountForm } from "@/components/create-tenant-demo-account-form";
import { TenantQuotaPanel } from "@/components/tenant-quota-panel";
import { PageGuide } from "@/components/erp/page-guide";

const ROLE_LABELS: Record<string, string> = { admin: "관리자", manager: "매니저", staff: "직원" };

export default async function PlatformAdminTenantDetailPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  // 권한 체크는 상위 platform-admin/layout.tsx에서 이미 끝났다.

  // 이 화면 전체가 회사(테넌트)를 넘나드는 조회/수정이라 RLS로는 표현할
  // 수 없다 — 대신 위에서 이미 플랫폼 운영자 권한을 확인했으므로, 여기서는
  // service_role 클라이언트로 직접 조회한다(플랫폼 관리자 화면 전용 패턴).
  const admin = createAdminClient();

  // 네 조회 모두 tenantId만 있으면 바로 돌 수 있는 독립적인 조회라
  // (plans/pointTransactions/members는 tenant 행 자체의 어떤 값도
  // 참조하지 않는다) 순서대로 기다리는 대신 한 번에 묶어서 보낸다.
  const [{ data: tenant }, { data: plans }, { data: pointTransactions }, { data: members }] = await Promise.all([
    admin
      .from("tenants")
      .select(
        "id, name, slug, created_at, disabled_at, plan, plan_key, plan_started_at, plan_expires_at, points_balance, db_quota_bytes, file_quota_bytes",
      )
      .eq("id", tenantId)
      .maybeSingle(),
    admin
      .from("platform_plans")
      .select("plan_key, name")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .limit(200),
    admin
      .from("point_transactions")
      .select("id, delta, action_type, reason, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(50),
    admin.from("tenant_members").select("user_id").eq("tenant_id", tenantId).limit(1000),
  ]);

  if (!tenant) {
    notFound();
  }

  const userIds = (members ?? []).map((m) => m.user_id);

  const { data: users } = userIds.length
    ? await admin.from("profiles").select("id, username, full_name, role, is_demo").in("id", userIds).limit(1000)
    : { data: [] };

  // 회사별 사용 현황 — 실제 업무 데이터 내용은 안 보여주고(플랫폼 운영자가
  // 볼 필요 없는 개인정보/영업정보), 활동 규모를 가늠할 개수만 센다.
  const [{ count: salesCount }, { count: purchasesCount }, { count: customersCount }, { data: usage }] = await Promise.all([
    admin.from("sales_orders").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
    admin.from("purchase_orders").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
    admin.from("customers").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
    admin.from("tenant_usage").select("db_bytes_used, file_bytes_used").eq("tenant_id", tenantId).maybeSingle(),
  ]);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h1 className="erp-h1">
          플랫폼 관리 &gt; 고객사 &gt; {tenant.name}
        </h1>
        <Link href="/platform-admin" className="erp-btn">
          목록으로
        </Link>
      </div>
      <PageGuide>이 회사의 정보 수정, 로그인 허용 여부, 요금제 상태, 소속 계정을 관리합니다.</PageGuide>

        <div className="erp-kpi-row" style={{ marginBottom: "var(--erp-space-5)" }}>
          <div className="erp-home-panel erp-kpi-card">
            <div className="erp-kpi-label">매출 건수</div>
            <div className="erp-kpi-value">{salesCount ?? 0}</div>
          </div>
          <div className="erp-home-panel erp-kpi-card">
            <div className="erp-kpi-label">매입 건수</div>
            <div className="erp-kpi-value">{purchasesCount ?? 0}</div>
          </div>
          <div className="erp-home-panel erp-kpi-card">
            <div className="erp-kpi-label">거래처 수</div>
            <div className="erp-kpi-value">{customersCount ?? 0}</div>
          </div>
          <div className="erp-home-panel erp-kpi-card">
            <div className="erp-kpi-label">계정 수 / 가입일</div>
            <div className="erp-kpi-value">{userIds.length}명</div>
            <div style={{ fontSize: "var(--erp-font-xs)", color: "var(--erp-text-muted)", marginTop: 2 }}>
              {new Date(tenant.created_at).toLocaleDateString("ko-KR")}
            </div>
          </div>
        </div>

        <div className="erp-detail" style={{ marginTop: 0, marginBottom: "var(--erp-space-5)" }}>
          <div className="erp-detail-tabs">
            <span className="erp-detail-tab active">회사 정보</span>
          </div>
          <div className="erp-detail-body">
            <EditCompanyForm tenantId={tenant.id} name={tenant.name} slug={tenant.slug} />
          </div>
        </div>

        <div className="erp-detail" style={{ marginTop: 0, marginBottom: "var(--erp-space-5)" }}>
          <div className="erp-detail-tabs">
            <span className="erp-detail-tab active">이용 상태</span>
          </div>
          <div className="erp-detail-body">
            <TenantStatusControls
              tenantId={tenant.id}
              disabled={tenant.disabled_at !== null}
              plan={tenant.plan}
              planKey={tenant.plan_key}
              plans={plans ?? []}
              planStartedAt={tenant.plan_started_at}
              planExpiresAt={tenant.plan_expires_at}
            />
          </div>
        </div>

        <div className="erp-detail" style={{ marginTop: 0, marginBottom: "var(--erp-space-5)" }}>
          <div className="erp-detail-tabs">
            <span className="erp-detail-tab active">포인트</span>
          </div>
          <div className="erp-detail-body">
            <TenantPointsPanel
              tenantId={tenant.id}
              balance={tenant.points_balance}
              transactions={pointTransactions ?? []}
            />
          </div>
        </div>

        <div className="erp-detail" style={{ marginTop: 0, marginBottom: "var(--erp-space-5)" }}>
          <div className="erp-detail-tabs">
            <span className="erp-detail-tab active">저장 공간 쿼터</span>
          </div>
          <div className="erp-detail-body">
            <TenantQuotaPanel
              tenantId={tenant.id}
              dbQuotaBytes={tenant.db_quota_bytes}
              fileQuotaBytes={tenant.file_quota_bytes}
              dbBytesUsed={usage?.db_bytes_used ?? 0}
              fileBytesUsed={usage?.file_bytes_used ?? 0}
            />
          </div>
        </div>

        <div className="erp-detail" style={{ marginTop: 0 }}>
          <div className="erp-detail-tabs">
            <span className="erp-detail-tab active">소속 계정 ({(users ?? []).length})</span>
          </div>
          <div className="erp-detail-body">
            <div style={{ marginBottom: "var(--erp-space-4)" }}>
              <CreateTenantDemoAccountForm tenantId={tenant.id} />
            </div>
            {!users?.length ? (
              <p className="erp-grid-empty">소속 계정이 없습니다.</p>
            ) : (
              <div className="erp-card-feed erp-card-feed-compact">
                {users.map((u) => (
                  <div
                    key={u.id}
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
                      <div style={{ fontSize: "var(--erp-font-md)", fontWeight: 600, color: "var(--erp-text)" }}>
                        {u.full_name}
                        {u.is_demo && (
                          <span style={{ marginLeft: "var(--erp-space-2)" }}>
                            <span className="erp-badge erp-badge-warning">데모</span>
                          </span>
                        )}
                        <span style={{ marginLeft: "var(--erp-space-2)" }}>
                          <span className="erp-badge erp-badge-muted">{ROLE_LABELS[u.role] ?? u.role}</span>
                        </span>
                      </div>
                      <div style={{ fontSize: "var(--erp-font-sm)", color: "var(--erp-text-muted)", marginTop: 3 }}>{u.username}</div>
                    </div>
                    <ResetTenantUserPasswordForm tenantId={tenant.id} userId={u.id} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
    </div>
  );
}
