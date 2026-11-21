import { createClient } from "@/lib/supabase/server";
import { ApprovalLinePresetForm } from "@/components/approval-line-preset-form";
import { createApprovalLinePreset } from "@/app/(dashboard)/approvals/lines/actions";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { CloseButton } from "@/components/erp/close-button";
import { ListPageHeader, FormSection } from "@/components/erp/page-header";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { requireFeatureEnabled } from "@/lib/require-feature-enabled";
import { buildOrgTree } from "@/lib/org-chart";

// 새 결재선 등록(C형 모달 내용) — 목록과 같은 기능(approvals) 사용 여부를 직접 접근에서도 확인한다.
export default async function NewApprovalLinePage() {
  const supabase = await createClient();
  await requireFeatureEnabled(supabase, "approvals");
  const [departments, profiles] = await Promise.all([
    fetchAllRows<{ id: string; name: string; parent_department_id: string | null; sort_order: number }>((from, to) =>
      supabase.from("departments").select("id, name, parent_department_id, sort_order").order("sort_order").range(from, to),
    ),
    fetchAllRows<{ id: string; full_name: string | null; position_title: string | null; department_id: string | null }>((from, to) =>
      supabase.from("profiles").select("id, full_name, position_title, department_id").order("full_name").range(from, to),
    ),
  ]);
  const orgTree = buildOrgTree(
    departments.map((d) => ({ id: d.id, name: d.name, parentDepartmentId: d.parent_department_id, sortOrder: d.sort_order })),
    profiles.map((p) => ({ id: p.id, fullName: p.full_name, positionTitle: p.position_title, departmentId: p.department_id })),
  );
  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/approvals/lines" } }} />
      <ListPageHeader title="전자결재 &gt; 새 결재선" actions={<CloseButton href="/approvals/lines">ESC 목록으로</CloseButton>} />
      <FormSection tabLabel="결재선 등록">
        <ApprovalLinePresetForm action={createApprovalLinePreset} orgTree={orgTree} submitLabel="추가" />
      </FormSection>
    </div>
  );
}
