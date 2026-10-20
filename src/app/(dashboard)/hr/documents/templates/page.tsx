import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentActor } from "@/lib/current-actor";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { AccessWall } from "@/components/erp/access-wall";
import { ListPageHeader } from "@/components/erp/page-header";
import { PageGuide } from "@/components/erp/page-guide";
import { GridBadge } from "@/components/grid/badge";
import { InlineConfirmDelete } from "@/components/inline-confirm-delete";
import { DocumentTemplateListBody } from "@/components/document-template-list-body";
import { deleteTemplate } from "@/app/(dashboard)/hr/documents/actions";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { isUuid } from "@/lib/is-uuid";

const CATEGORY_LABELS: Record<string, string> = {
  hr_contract: "인사 · 계약서",
  hr_certificate: "인사 · 증명서",
  approval: "전자결재 서식",
  general: "기타",
};

export default async function DocumentTemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const supabase = await createClient();
  const { isAdmin } = await getCurrentActor(supabase);

  if (!isAdmin) {
    return <AccessWall title="그룹웨어 > 문서 양식 관리" message="이 화면은 관리자만 볼 수 있습니다." backHref="/dashboard" />;
  }

  const { id } = await searchParams;
  const selectedId = id && isUuid(id) ? id : undefined;
  const listHref = "/hr/documents/templates";

  const [templates, selected] = await Promise.all([
    fetchAllRows<{
      id: string;
      name: string;
      category: string;
      is_active: boolean;
    }>((from, to) =>
      supabase.from("document_templates").select("id, name, category, is_active").order("category").range(from, to),
    ),
    selectedId
      ? supabase
          .from("document_templates")
          .select("id, name, body, category, is_active")
          .eq("id", selectedId)
          .maybeSingle()
          .then((r) => r.data)
      : Promise.resolve(null),
  ]);

  return (
    <div>
      <KeyboardShortcuts
        shortcuts={{
          F2: { href: "/hr/documents/templates/new" },
          Escape: { href: selectedId ? listHref : "/hr/documents" },
        }}
      />
      <ListPageHeader
        title="그룹웨어 > 문서 양식 관리"
        actions={
          <>
            <Link href="/hr/documents/templates/new" className="erp-btn erp-btn-primary">
              F2 새 양식
            </Link>
            <Link href="/hr/documents" className="erp-btn erp-btn-dark">
              ESC 문서함으로
            </Link>
          </>
        }
      />

      <PageGuide>
        근로계약서 등 법정 서식은 고용노동부가 배포하는 공식 양식 문구를
        그대로 붙여넣어 등록해주세요 — 직접 새로 작성한 문구를 법적
        서식으로 쓰면 리스크가 있습니다. {"{{필드명}}"} 자리마다 문서
        생성 시 입력값으로 채워집니다.
      </PageGuide>

      <div className="erp-split3-shell erp-comm-shell" data-mobile-view={selectedId ? "detail" : "list"}>
        <DocumentTemplateListBody
          rows={templates.map((t) => ({ id: t.id, name: t.name, category: t.category, isActive: t.is_active }))}
          selectedId={selectedId}
          basePath={listHref}
        />

        <div className="erp-split-detail">
          {selected ? (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 4 }}>
                <h2 className="text-base font-bold" style={{ color: "var(--erp-text)" }}>{selected.name}</h2>
                <GridBadge tone={selected.is_active ? "ok" : "muted"}>{selected.is_active ? "사용중" : "미사용"}</GridBadge>
              </div>
              <p className="mb-4 text-xs" style={{ color: "var(--erp-text-muted)" }}>
                {CATEGORY_LABELS[selected.category] ?? selected.category}
              </p>

              <div
                style={{
                  background: "var(--erp-bg)",
                  border: "1px solid var(--erp-divider)",
                  borderRadius: "var(--erp-comm-radius-row)",
                  padding: "18px 20px",
                  fontSize: 12.5,
                  lineHeight: 1.8,
                  color: "var(--erp-text)",
                  whiteSpace: "pre-line",
                  marginBottom: 18,
                }}
              >
                {selected.body}
              </div>

              <div className="flex gap-2">
                <Link href={`/hr/documents/templates/${selected.id}/edit`} className="erp-btn">
                  수정
                </Link>
                <InlineConfirmDelete
                  action={deleteTemplate}
                  hiddenFields={{ id: selected.id }}
                  warningText="이 양식을 삭제하시겠습니까? 이미 생성된 문서는 남습니다."
                />
              </div>
            </>
          ) : (
            <p className="p-3 text-xs" style={{ color: "var(--erp-text-muted)" }}>
              왼쪽 목록에서 양식을 선택해주세요.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
