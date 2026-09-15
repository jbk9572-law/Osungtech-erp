import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ApprovalLinePresetForm } from "@/components/approval-line-preset-form";
import { updateApprovalLinePreset } from "@/app/(dashboard)/approvals/lines/actions";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { CloseButton } from "@/components/erp/close-button";
import { ListPageHeader, FormSection } from "@/components/erp/page-header";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { buildOrgTree } from "@/lib/org-chart";

export default async function EditApprovalLinePresetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: preset }, departments, profiles] = await Promise.all([
    supabase.from("approval_line_presets").select("id, name, approver_ids, reference_ids").eq("id", id).maybeSingle(),
    fetchAllRows<{ id: string; name: string; parent_department_id: string | null; sort_order: number }>((from, to) =>
      supabase.from("departments").select("id, name, parent_department_id, sort_order").order("sort_order").range(from, to),
    ),
    fetchAllRows<{ id: string; full_name: string | null; position_title: string | null; department_id: string | null }>(
      (from, to) => supabase.from("profiles").select("id, full_name, position_title, department_id").order("full_name").range(from, to),
    ),
  ]);

  if (!preset) {
    notFound();
  }

  const orgTree = buildOrgTree(
    departments.map((d) => ({ id: d.id, name: d.name, parentDepartmentId: d.parent_department_id, sortOrder: d.sort_order })),
    profiles.map((p) => ({ id: p.id, fullName: p.full_name, positionTitle: p.position_title, departmentId: p.department_id })),
  );
  const nameById: Record<string, string> = {};
  for (const p of profiles) nameById[p.id] = p.full_name || "구성원";

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/approvals/lines" } }} />
      <ListPageHeader
        title="전자결재 > 공유 결재선 > 결재선 수정"
        actions={<CloseButton href="/approvals/lines">ESC 목록으로</CloseButton>}
      />
      <FormSection tabLabel="결재선 수정">
        <ApprovalLinePresetForm
          action={updateApprovalLinePreset}
          orgTree={orgTree}
          submitLabel="저장"
          initial={{
            id: preset.id,
            name: preset.name,
            approvers: preset.approver_ids.map((pid) => ({ id: pid, name: nameById[pid] ?? "구성원" })),
            references: preset.reference_ids.map((pid) => ({ id: pid, name: nameById[pid] ?? "구성원" })),
          }}
        />
      </FormSection>
    </div>
  );
}
