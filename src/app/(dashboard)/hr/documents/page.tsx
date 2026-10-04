import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { FormSection } from "@/components/erp/page-header";
import { PageGuide } from "@/components/erp/page-guide";
import { GridBadge } from "@/components/grid/badge";
import { GenerateDocumentForm } from "@/components/generate-document-form";
import { DocumentDetailPanel } from "@/components/document-detail-panel";
import { createDocument } from "@/app/(dashboard)/hr/documents/actions";
import { requireFeatureEnabled } from "@/lib/require-feature-enabled";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { isUuid } from "@/lib/is-uuid";
import { formatNumber } from "@/lib/format-number";

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  const selectedId = id && isUuid(id) ? id : undefined;
  const supabase = await createClient();
  await requireFeatureEnabled(supabase, "hr");

  // document_instances_select RLS가 이미 "내가 만들었거나 나에 대한
  // 문서 또는 관리자"로 걸러준다. 화면 자체에도 상한을 둔다.
  const [{ data: docs }, templates, profileRows, { data: company }] = await Promise.all([
    supabase
      .from("document_instances")
      .select("id, title, category, status, created_at, profiles!subject_user_id(full_name)")
      .order("created_at", { ascending: false })
      .limit(200),
    fetchAllRows<{ id: string; name: string; body: string }>((from, to) =>
      supabase.from("document_templates").select("id, name, body").eq("is_active", true).order("name").range(from, to),
    ),
    fetchAllRows<{
      id: string;
      full_name: string | null;
      position_title: string | null;
      hire_date: string | null;
      departments: { name: string } | null;
    }>((from, to) =>
      supabase
        .from("profiles")
        .select("id, full_name, position_title, hire_date, departments(name)")
        .order("full_name")
        .range(from, to),
    ),
    supabase.from("company_profile").select("name, representative_name").maybeSingle(),
  ]);

  // 재직증명서 등 기본 양식이 소속/직위/입사일을 자동으로 채우려면 이
  // 형태(department_name 평평한 필드)가 필요하다 — document-template.ts
  // AUTO_FILL_FIELD_KEYS 참고.
  const employees = profileRows.map((p) => ({
    id: p.id,
    full_name: p.full_name,
    position_title: p.position_title,
    hire_date: p.hire_date,
    department_name: p.departments?.name ?? null,
  }));

  const rowHref = (docId: string) => `/hr/documents?id=${docId}`;
  const newHref = "/hr/documents";

  return (
    <div>
      <KeyboardShortcuts
        shortcuts={{ F2: { href: newHref }, Escape: { href: selectedId ? newHref : "/dashboard" } }}
      />
      <div className="erp-page-toolbar erp-detail-header-row">
        <h1 className="text-lg font-bold text-[var(--erp-text)]">그룹웨어 &gt; 문서함</h1>
        <div className="erp-toolbar" style={{ marginBottom: 0 }}>
          <Link href={newHref} className="erp-btn erp-btn-primary">
            F2 새 문서
          </Link>
          <Link href="/hr/documents/templates" className="erp-btn">
            양식 관리
          </Link>
          {selectedId && (
            <Link href={newHref} className="erp-btn">
              목록
            </Link>
          )}
        </div>
      </div>

      <div className="erp-split-shell" data-mobile-view={selectedId ? "detail" : "list"}>
        <section className="erp-split-list">
          <div className="erp-split-list-head">
            <span>문서 목록</span>
            <span style={{ color: "var(--erp-text-muted)", fontWeight: 400 }}>
              총 {formatNumber((docs ?? []).length)}건
            </span>
          </div>
          <div className="erp-split-list-body">
            {(docs ?? []).map((d) => (
              <Link
                key={d.id}
                href={rowHref(d.id)}
                className={`erp-split-list-row${d.id === selectedId ? " active" : ""}`}
              >
                {d.title}
                <span style={{ marginLeft: 6 }}>
                  <GridBadge tone={d.status === "issued" ? "ok" : "warn"}>
                    {d.status === "issued" ? "발급완료" : "초안"}
                  </GridBadge>
                </span>
                <div className="erp-split-list-row-sub">
                  {new Date(d.created_at).toLocaleDateString("ko-KR")}
                  {d.profiles?.full_name ? ` · ${d.profiles.full_name}` : ""}
                </div>
              </Link>
            ))}
            {(docs ?? []).length === 0 && (
              <p className="p-3 text-xs" style={{ color: "var(--erp-text-muted)" }}>
                생성된 문서가 없습니다.
              </p>
            )}
          </div>
        </section>

        <div className="erp-split-detail">
          {selectedId ? (
            <DocumentDetailPanel id={selectedId} />
          ) : (
            <>
              <PageGuide>
                양식을 고르면 그 안에 있는 병합필드 입력칸이 나타납니다. 대상
                직원을 고르면 직원명 등 알아볼 수 있는 필드는 자동으로
                채워집니다(수정 가능).
              </PageGuide>
              {templates.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--erp-text-muted)" }}>
                  사용 가능한 양식이 없습니다. 문서 양식 관리에서 먼저 등록해주세요.
                </p>
              ) : (
                <FormSection tabLabel="새 문서 작성">
                  <GenerateDocumentForm
                    action={createDocument}
                    templates={templates}
                    employees={employees}
                    companyName={company?.name ?? null}
                    representativeName={company?.representative_name ?? null}
                  />
                </FormSection>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
