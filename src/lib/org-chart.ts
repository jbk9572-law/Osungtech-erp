// 부서(flat 목록) + 직원 목록을 조직도 트리로 조립하는 순수 함수.
// 결재선 선택기(OrgChartPicker) 등 여러 화면에서 같은 트리 구조를
// 재사용해야 해서 프레임워크 의존 없이 뺐다.
export type OrgEmployee = { id: string; fullName: string; positionTitle: string | null };
export type OrgDepartmentNode = {
  id: string;
  name: string;
  children: OrgDepartmentNode[];
  employees: OrgEmployee[];
};

export type FlatDepartment = { id: string; name: string; parentDepartmentId: string | null; sortOrder: number };
export type FlatEmployee = {
  id: string;
  fullName: string | null;
  positionTitle: string | null;
  departmentId: string | null;
};

// 부서 미배정 직원은 "미배정" 가상 루트 노드(id: null) 아래로 모은다 —
// 화면에서 아예 안 보이면 "이 사람은 결재선에 못 넣나?"는 혼란이 생긴다.
export const UNASSIGNED_DEPARTMENT_ID = "__unassigned__";

export function buildOrgTree(departments: FlatDepartment[], employees: FlatEmployee[]): OrgDepartmentNode[] {
  const nodeById = new Map<string, OrgDepartmentNode>();
  for (const d of departments) {
    nodeById.set(d.id, { id: d.id, name: d.name, children: [], employees: [] });
  }

  const roots: OrgDepartmentNode[] = [];
  const sorted = [...departments].sort((a, b) => a.sortOrder - b.sortOrder);
  for (const d of sorted) {
    const node = nodeById.get(d.id)!;
    if (d.parentDepartmentId && nodeById.has(d.parentDepartmentId)) {
      nodeById.get(d.parentDepartmentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const unassigned: OrgEmployee[] = [];
  for (const e of employees) {
    const entry: OrgEmployee = { id: e.id, fullName: e.fullName || "구성원", positionTitle: e.positionTitle };
    const dept = e.departmentId ? nodeById.get(e.departmentId) : undefined;
    if (dept) dept.employees.push(entry);
    else unassigned.push(entry);
  }

  if (unassigned.length > 0) {
    roots.push({ id: UNASSIGNED_DEPARTMENT_ID, name: "미배정", children: [], employees: unassigned });
  }

  return roots;
}
