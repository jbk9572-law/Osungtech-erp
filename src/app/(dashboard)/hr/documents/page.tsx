import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { PageGuide } from "@/components/erp/page-guide";
import { GridBadge } from "@/components/grid/badge";
import { ClickableRow } from "@/components/clickable-row";
import { requireFeatureEnabled } from "@/lib/require-feature-enabled";

export default async function DocumentsPage() {
  const supabase = await createClient();
  await requireFeatureEnabled(supabase, "hr");

  // document_instances_select RLS가 이미 "내가 만들었거나 나에 대한
  // 문서 또는 관리자"로 걸러준다. 화면 자체에도 상한을 둔다.
  const { data: docs } = await supabase
    .from("document_instances")
    .select("id, title, category, status, created_at, profiles!subject_user_id(full_name)")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ F2: { href: "/hr/documents/new" }, Escape: { href: "/dashboard" } }} />
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-lg font-bold text-[var(--erp-text)]">인사관리 &gt; 문서함</h1>
        <div className="erp-toolbar" style={{ marginBottom: 0 }}>
          <Link href="/hr/documents/new" className="erp-btn erp-btn-primary">
            F2 새 문서
          </Link>
          <Link href="/hr/documents/templates" className="erp-btn">
            양식 관리
          </Link>
        </div>
      </div>

      <PageGuide>
        근로계약서 등 양식으로 생성한 문서 목록입니다. 본인이 만들었거나
        본인에 대한 문서만 보입니다(관리자는 전체).
      </PageGuide>

      {(docs ?? []).length === 0 ? (
        <p className="text-sm" style={{ color: "var(--erp-text-muted)" }}>
          생성된 문서가 없습니다.
        </p>
      ) : (
        <div className="erp-grid-wrap">
          <table className="erp-grid">
            <thead>
              <tr>
                <th style={{ width: 130 }}>일시</th>
                <th>제목</th>
                <th style={{ width: 110 }}>대상 직원</th>
                <th style={{ width: 90 }}>상태</th>
              </tr>
            </thead>
            <tbody>
              {(docs ?? []).map((d) => (
                <ClickableRow key={d.id} href={`/hr/documents/${d.id}`}>
                  <td>{new Date(d.created_at).toLocaleDateString("ko-KR")}</td>
                  <td>{d.title}</td>
                  <td>{d.profiles?.full_name ?? "-"}</td>
                  <td>
                    <GridBadge tone={d.status === "issued" ? "ok" : "warn"}>
                      {d.status === "issued" ? "발급완료" : "초안"}
                    </GridBadge>
                  </td>
                </ClickableRow>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
