import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/require-platform-admin";
import { CreateCompanyForm } from "@/components/create-company-form";
import { PageGuide } from "@/components/erp/page-guide";
import { isPlanExpired } from "@/lib/tenant-plan";

const PLAN_LABELS: Record<string, string> = {
  trial: "체험",
  active: "정상 이용",
  suspended: "이용 중지",
};

// 타 업체(테넌트) 온보딩의 유일한 입구. 공개 회원가입 페이지가 없는
// 지금 구조상, 새 고객사는 이 화면에서 플랫폼 운영자가 직접 만들어준다
// — 오성테크도 여러 회사 중 하나(테넌트 #1)가 되는 구조로 바뀐 뒤의
// 후속 조치.
export default async function PlatformAdminPage() {
  // 권한 체크(로그인 안 됐거나 플랫폼 운영자가 아니면 리다이렉트)는
  // 상위 platform-admin/layout.tsx에서 이미 끝냈다 — 여기서는 supabase
  // 클라이언트만 받아 쓴다.
  const { supabase } = await requirePlatformAdmin();

  // 플랫폼 전체 고객사 수는 당분간 1000곳을 넘을 일이 없다(직접 영업
  // 기반 B2B ERP) — 넘어설 정도로 커지면 그때 fetchAllRows()로 바꾼다.
  const { data: tenants } = await supabase
    .from("tenants")
    .select("id, name, slug, created_at, disabled_at, plan, plan_expires_at")
    .order("created_at", { ascending: true })
    .limit(1000);

  return (
    <div>
      <h1 className="mb-1 erp-h1">플랫폼 관리 &gt; 고객사</h1>
      <PageGuide>엘보닉스를 쓰는 회사(테넌트) 목록과, 새 고객사를 추가하는 화면입니다.</PageGuide>

      <div className="erp-detail" style={{ marginTop: 0, marginBottom: 16 }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">새 회사 추가</span>
        </div>
        <div className="erp-detail-body">
          <CreateCompanyForm />
        </div>
      </div>

      {!tenants?.length ? (
        <p className="erp-grid-empty">등록된 회사가 없습니다.</p>
      ) : (
        <div className="erp-card-feed erp-card-feed-compact">
          {tenants.map((t) => {
            const isExpired = isPlanExpired(t.plan_expires_at);
            const isBlocked = t.disabled_at !== null || isExpired;
            return (
              <div
                key={t.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                  background: "var(--erp-panel)",
                  border: "1px solid var(--erp-comm-border)",
                  borderRadius: "var(--erp-comm-radius-row)",
                  boxShadow: "var(--erp-comm-shadow-row)",
                  padding: "13px 18px",
                  flex: "0 0 auto",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--erp-text)" }}>
                    {t.name}
                    <span style={{ marginLeft: 6 }}>
                      <span className={`erp-badge ${isBlocked ? "erp-badge-danger" : "erp-badge-success"}`}>
                        {t.disabled_at ? "비활성" : isExpired ? "만료됨" : "활성"}
                      </span>
                    </span>
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--erp-text-muted)", marginTop: 3 }}>
                    {t.slug} · {PLAN_LABELS[t.plan] ?? t.plan} · {new Date(t.created_at).toLocaleDateString("ko-KR")}
                  </div>
                </div>
                <Link href={`/platform-admin/${t.id}`} className="erp-btn" style={{ minWidth: 0, flex: "0 0 auto" }}>
                  상세
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
