import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/require-platform-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { EditCompanyForm } from "@/components/edit-company-form";
import { TenantStatusControls } from "@/components/tenant-status-controls";
import { TenantPointsPanel } from "@/components/tenant-points-panel";
import { ResetTenantUserPasswordForm } from "@/components/reset-tenant-user-password-form";
import { PageGuide } from "@/components/erp/page-guide";
import "@/app/erp-theme.css";

const ROLE_LABELS: Record<string, string> = { admin: "관리자", manager: "매니저", staff: "직원" };

export default async function PlatformAdminTenantDetailPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const { isPlatformAdmin } = await requirePlatformAdmin();
  if (!isPlatformAdmin) {
    redirect("/login");
  }

  // 이 화면 전체가 회사(테넌트)를 넘나드는 조회/수정이라 RLS로는 표현할
  // 수 없다 — 대신 위에서 이미 플랫폼 운영자 권한을 확인했으므로, 여기서는
  // service_role 클라이언트로 직접 조회한다(플랫폼 관리자 화면 전용 패턴).
  const admin = createAdminClient();

  const { data: tenant } = await admin
    .from("tenants")
    .select("id, name, slug, created_at, disabled_at, plan, plan_started_at, plan_expires_at, points_balance")
    .eq("id", tenantId)
    .maybeSingle();

  if (!tenant) {
    notFound();
  }

  const { data: pointTransactions } = await admin
    .from("point_transactions")
    .select("id, delta, action_type, reason, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(50);

  const { data: members } = await admin
    .from("tenant_members")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .limit(1000);
  const userIds = (members ?? []).map((m) => m.user_id);

  const { data: users } = userIds.length
    ? await admin.from("profiles").select("id, username, full_name, role").in("id", userIds).limit(1000)
    : { data: [] };

  // 회사별 사용 현황 — 실제 업무 데이터 내용은 안 보여주고(플랫폼 운영자가
  // 볼 필요 없는 개인정보/영업정보), 활동 규모를 가늠할 개수만 센다.
  const [{ count: salesCount }, { count: purchasesCount }, { count: customersCount }] = await Promise.all([
    admin.from("sales_orders").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
    admin.from("purchase_orders").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
    admin.from("customers").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
  ]);

  return (
    <div className="erp" style={{ minHeight: "100vh", background: "var(--erp-bg)" }}>
      <div style={{ maxWidth: 880, margin: "0 auto", padding: "40px 20px" }}>
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-lg font-bold text-[var(--erp-text)]">
            플랫폼 관리 &gt; 고객사 &gt; {tenant.name}
          </h1>
          <Link href="/platform-admin" className="erp-btn">
            목록으로
          </Link>
        </div>
        <PageGuide>이 회사의 정보 수정, 로그인 허용 여부, 요금제 상태, 소속 계정을 관리합니다.</PageGuide>

        <div className="erp-grid-wrap" style={{ marginBottom: 16 }}>
          <table className="erp-grid">
            <thead>
              <tr>
                <th>매출 건수</th>
                <th>매입 건수</th>
                <th>거래처 수</th>
                <th>계정 수</th>
                <th style={{ width: 140 }}>가입일</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{salesCount ?? 0}</td>
                <td>{purchasesCount ?? 0}</td>
                <td>{customersCount ?? 0}</td>
                <td>{userIds.length}</td>
                <td>{new Date(tenant.created_at).toLocaleDateString("ko-KR")}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="erp-detail" style={{ marginTop: 0, marginBottom: 16 }}>
          <div className="erp-detail-tabs">
            <span className="erp-detail-tab active">회사 정보</span>
          </div>
          <div className="erp-detail-body">
            <EditCompanyForm tenantId={tenant.id} name={tenant.name} slug={tenant.slug} />
          </div>
        </div>

        <div className="erp-detail" style={{ marginTop: 0, marginBottom: 16 }}>
          <div className="erp-detail-tabs">
            <span className="erp-detail-tab active">이용 상태</span>
          </div>
          <div className="erp-detail-body">
            <TenantStatusControls
              tenantId={tenant.id}
              disabled={tenant.disabled_at !== null}
              plan={tenant.plan}
              planStartedAt={tenant.plan_started_at}
              planExpiresAt={tenant.plan_expires_at}
            />
          </div>
        </div>

        <div className="erp-detail" style={{ marginTop: 0, marginBottom: 16 }}>
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

        <div className="erp-detail" style={{ marginTop: 0 }}>
          <div className="erp-detail-tabs">
            <span className="erp-detail-tab active">소속 계정 ({(users ?? []).length})</span>
          </div>
          <div className="erp-detail-body">
            <div className="erp-grid-wrap">
              <table className="erp-grid">
                <thead>
                  <tr>
                    <th>이름</th>
                    <th>아이디</th>
                    <th>역할</th>
                    <th style={{ width: 260 }}>비밀번호</th>
                  </tr>
                </thead>
                <tbody>
                  {(users ?? []).map((u) => (
                    <tr key={u.id}>
                      <td>{u.full_name}</td>
                      <td style={{ color: "var(--erp-text-muted)" }}>{u.username}</td>
                      <td>{ROLE_LABELS[u.role] ?? u.role}</td>
                      <td>
                        <ResetTenantUserPasswordForm tenantId={tenant.id} userId={u.id} />
                      </td>
                    </tr>
                  ))}
                  {!users?.length && (
                    <tr>
                      <td colSpan={4} className="erp-grid-empty">
                        소속 계정이 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
