import { redirect } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/require-platform-admin";
import { CreateCompanyForm } from "@/components/create-company-form";
import { PageGuide } from "@/components/erp/page-guide";
import "@/app/erp-theme.css";

// 타 업체(테넌트) 온보딩의 유일한 입구. 공개 회원가입 페이지가 없는
// 지금 구조상, 새 고객사는 이 화면에서 플랫폼 운영자가 직접 만들어준다
// — 오성테크도 여러 회사 중 하나(테넌트 #1)가 되는 구조로 바뀐 뒤의
// 후속 조치.
export default async function PlatformAdminPage() {
  const { supabase, isPlatformAdmin } = await requirePlatformAdmin();

  if (!isPlatformAdmin) {
    redirect("/login");
  }

  // 플랫폼 전체 고객사 수는 당분간 1000곳을 넘을 일이 없다(직접 영업
  // 기반 B2B ERP) — 넘어설 정도로 커지면 그때 fetchAllRows()로 바꾼다.
  const { data: tenants } = await supabase
    .from("tenants")
    .select("id, name, slug, created_at")
    .order("created_at", { ascending: true })
    .limit(1000);

  return (
    <div className="erp" style={{ minHeight: "100vh", background: "var(--erp-bg)" }}>
      <div style={{ maxWidth: 880, margin: "0 auto", padding: "40px 20px" }}>
        <h1 className="mb-1 text-lg font-bold text-[var(--erp-text)]">플랫폼 관리 &gt; 고객사</h1>
        <PageGuide>엘보닉스를 쓰는 회사(테넌트) 목록과, 새 고객사를 추가하는 화면입니다.</PageGuide>

        <div className="erp-detail" style={{ marginTop: 0, marginBottom: 16 }}>
          <div className="erp-detail-tabs">
            <span className="erp-detail-tab active">새 회사 추가</span>
          </div>
          <div className="erp-detail-body">
            <CreateCompanyForm />
          </div>
        </div>

        <div className="erp-grid-wrap">
          <table className="erp-grid">
            <thead>
              <tr>
                <th>회사명</th>
                <th>슬러그</th>
                <th style={{ width: 140 }}>가입일</th>
              </tr>
            </thead>
            <tbody>
              {(tenants ?? []).map((t) => (
                <tr key={t.id}>
                  <td>{t.name}</td>
                  <td style={{ color: "var(--erp-text-muted)" }}>{t.slug}</td>
                  <td>{new Date(t.created_at).toLocaleDateString("ko-KR")}</td>
                </tr>
              ))}
              {!tenants?.length && (
                <tr>
                  <td colSpan={3} className="erp-grid-empty">
                    등록된 회사가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
