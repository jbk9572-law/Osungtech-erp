import { createClient } from "@/lib/supabase/server";
import { ApprovalDocumentForm } from "@/components/approval-document-form";
import { submitApprovalDocument } from "@/app/(dashboard)/approvals/actions";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { CloseButton } from "@/components/erp/close-button";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { buildOrgTree } from "@/lib/org-chart";

export default async function NewApprovalDocumentPage() {
  const supabase = await createClient();

  const [departments, profiles, templates] = await Promise.all([
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
  ]);

  const orgTree = buildOrgTree(
    departments.map((d) => ({ id: d.id, name: d.name, parentDepartmentId: d.parent_department_id, sortOrder: d.sort_order })),
    profiles.map((p) => ({ id: p.id, fullName: p.full_name, positionTitle: p.position_title, departmentId: p.department_id })),
  );

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/approvals" } }} />
      <h1 className="mb-3 text-lg font-bold text-[var(--erp-text)]">전자결재 &gt; 기안</h1>

      <div className="erp-toolbar">
        <CloseButton href="/approvals">ESC 목록으로</CloseButton>
      </div>

      <div className="erp-detail" style={{ marginTop: 0 }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">기안서 작성</span>
        </div>
        <div className="erp-detail-body">
          <ApprovalDocumentForm action={submitApprovalDocument} orgTree={orgTree} templates={templates} />
        </div>
      </div>
    </div>
  );
}
