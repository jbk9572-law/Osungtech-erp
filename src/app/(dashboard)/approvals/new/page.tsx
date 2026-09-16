import { createClient, getUser } from "@/lib/supabase/server";
import { ApprovalDocumentForm } from "@/components/approval-document-form";
import { submitApprovalDocument, submitApprovalDraft, saveApprovalDraft } from "@/app/(dashboard)/approvals/actions";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { CloseButton } from "@/components/erp/close-button";
import { ListPageHeader, FormSection } from "@/components/erp/page-header";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { buildOrgTree } from "@/lib/org-chart";

export default async function NewApprovalDocumentPage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string }>;
}) {
  const { draft: draftId } = await searchParams;
  const supabase = await createClient();
  const user = await getUser();

  const [departments, profiles, templates, presetsRaw, matrixRaw, draftDoc] = await Promise.all([
    fetchAllRows<{ id: string; name: string; parent_department_id: string | null; sort_order: number }>((from, to) =>
      supabase.from("departments").select("id, name, parent_department_id, sort_order").order("sort_order").range(from, to),
    ),
    fetchAllRows<{ id: string; full_name: string | null; position_title: string | null; department_id: string | null }>(
      (from, to) => supabase.from("profiles").select("id, full_name, position_title, department_id").order("full_name").range(from, to),
    ),
    fetchAllRows<{ id: string; name: string; body: string }>((from, to) =>
      supabase
        .from("document_templates")
        .select("id, name, body")
        .eq("category", "approval")
        .eq("is_active", true)
        .order("name")
        .range(from, to),
    ),
    fetchAllRows<{ id: string; name: string; approver_ids: string[]; reference_ids: string[] }>((from, to) =>
      supabase.from("approval_line_presets").select("id, name, approver_ids, reference_ids").order("name").range(from, to),
    ),
    fetchAllRows<{ template_id: string; preset_id: string }>((from, to) =>
      supabase.from("approval_matrix_rules").select("template_id, preset_id").range(from, to),
    ),
    draftId
      ? supabase
          .from("approval_documents")
          .select("id, title, content, status, created_by, draft_approver_ids, draft_reference_ids")
          .eq("id", draftId)
          .eq("status", "draft")
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const orgTree = buildOrgTree(
    departments.map((d) => ({ id: d.id, name: d.name, parentDepartmentId: d.parent_department_id, sortOrder: d.sort_order })),
    profiles.map((p) => ({ id: p.id, fullName: p.full_name, positionTitle: p.position_title, departmentId: p.department_id })),
  );

  const profileNameById: Record<string, string> = {};
  for (const p of profiles) profileNameById[p.id] = p.full_name || "구성원";

  const presets = presetsRaw.map((p) => ({ id: p.id, name: p.name, approverIds: p.approver_ids, referenceIds: p.reference_ids }));
  const matrixByTemplate: Record<string, string> = {};
  for (const m of matrixRaw) matrixByTemplate[m.template_id] = m.preset_id;

  // draft 문서는 본인 것만 이어 쓸 수 있다 — 다른 사람 draft 링크로
  // 직접 접근해도(URL 추측 등) RLS가 애초에 select 자체를 막지만, 혹시
  // draftDoc.data가 비어 조용히 "새 문서"로 보이는 것도 이상하니 명시적으로
  // 걸러 안내한다.
  const draft = draftDoc?.data && draftDoc.data.created_by === user?.id ? draftDoc.data : null;
  const initialDraft = draft
    ? {
        id: draft.id,
        title: draft.title,
        content: draft.content,
        approverIds: draft.draft_approver_ids ?? [],
        referenceIds: draft.draft_reference_ids ?? [],
      }
    : undefined;

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/approvals" } }} />
      <ListPageHeader
        title={initialDraft ? "전자결재 > 기안 (임시저장 이어쓰기)" : "전자결재 > 기안"}
        actions={<CloseButton href="/approvals">ESC 목록으로</CloseButton>}
      />

      <FormSection tabLabel="기안서 작성">
        <ApprovalDocumentForm
          action={initialDraft ? submitApprovalDraft : submitApprovalDocument}
          draftAction={saveApprovalDraft}
          orgTree={orgTree}
          templates={templates}
          presets={presets}
          matrixByTemplate={matrixByTemplate}
          profileNameById={profileNameById}
          initialDraft={initialDraft}
        />
      </FormSection>
    </div>
  );
}
