import type { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { buildOrgTree } from "@/lib/org-chart";

type Supa = Awaited<ReturnType<typeof createClient>>;

// 결재선을 고르는 신청 폼(휴가·근태 정정 등)이 같이 쓰는 서버 쪽 자료 — 조직도, 저장된 결재선, 이름표.
// 화면마다 같은 조회를 다시 짜지 않는다(개발헌법 3번).
export async function loadApprovalFormData(supabase: Supa) {
  const [departments, profiles, presetsRaw] = await Promise.all([
    fetchAllRows<{ id: string; name: string; parent_department_id: string | null; sort_order: number }>((from, to) =>
      supabase.from("departments").select("id, name, parent_department_id, sort_order").order("sort_order").range(from, to),
    ),
    fetchAllRows<{ id: string; full_name: string | null; position_title: string | null; department_id: string | null }>((from, to) =>
      supabase.from("profiles").select("id, full_name, position_title, department_id").order("full_name").range(from, to),
    ),
    fetchAllRows<{ id: string; name: string; approver_ids: string[]; reference_ids: string[] }>((from, to) =>
      supabase.from("approval_line_presets").select("id, name, approver_ids, reference_ids").order("name").range(from, to),
    ),
  ]);
  const orgTree = buildOrgTree(
    departments.map((d) => ({ id: d.id, name: d.name, parentDepartmentId: d.parent_department_id, sortOrder: d.sort_order })),
    profiles.map((p) => ({ id: p.id, fullName: p.full_name, positionTitle: p.position_title, departmentId: p.department_id })),
  );
  const profileNameById: Record<string, string> = {};
  for (const p of profiles) profileNameById[p.id] = p.full_name || "구성원";
  const presets = presetsRaw.map((p) => ({ id: p.id, name: p.name, approverIds: p.approver_ids, referenceIds: p.reference_ids }));
  return { orgTree, presets, profileNameById };
}
