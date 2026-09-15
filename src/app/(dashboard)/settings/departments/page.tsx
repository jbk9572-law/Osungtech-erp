import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentActor } from "@/lib/current-actor";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { PageGuide } from "@/components/erp/page-guide";
import { InlineConfirmDelete } from "@/components/inline-confirm-delete";
import { EmployeeDepartmentForm } from "@/components/employee-department-form";
import { deleteDepartment, setEmployeeDepartment } from "@/app/(dashboard)/settings/departments/actions";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { buildOrgTree, type OrgDepartmentNode } from "@/lib/org-chart";

function DepartmentNode({ node, depth }: { node: OrgDepartmentNode; depth: number }) {
  const isReal = !node.id.startsWith("__");
  return (
    <div style={{ marginLeft: depth * 20, marginBottom: 4 }}>
      <div className="flex items-center gap-2" style={{ padding: "4px 0" }}>
        <span style={{ fontWeight: depth === 0 ? 700 : 500 }}>
          {"└ ".repeat(depth > 0 ? 1 : 0)}
          {node.name}
        </span>
        <span className="text-xs" style={{ color: "var(--erp-text-muted)" }}>
          {node.employees.length}명
        </span>
        {isReal && (
          <>
            <Link href={`/settings/departments/${node.id}/edit`} className="erp-btn" style={{ minWidth: 0, height: 22, padding: "0 8px", fontSize: 11 }}>
              수정
            </Link>
            <InlineConfirmDelete
              action={deleteDepartment}
              hiddenFields={{ id: node.id }}
              warningText="이 부서를 삭제하시겠습니까? 하위 부서/소속 직원은 미배정으로 남습니다."
              triggerStyle={{ minWidth: 0, height: 22, padding: "0 8px", fontSize: 11 }}
            />
          </>
        )}
      </div>
      {node.employees.length > 0 && (
        <div className="text-xs" style={{ marginLeft: 20, color: "var(--erp-text-muted)" }}>
          {node.employees.map((e) => e.fullName + (e.positionTitle ? `(${e.positionTitle})` : "")).join(", ")}
        </div>
      )}
      {node.children.map((child) => (
        <DepartmentNode key={child.id} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}

export default async function DepartmentsPage() {
  const supabase = await createClient();
  const { isAdmin } = await getCurrentActor(supabase);

  if (!isAdmin) {
    return (
      <div>
        <h1 className="mb-1 text-lg font-bold text-[var(--erp-text)]">환경설정 &gt; 조직도 관리</h1>
        <p className="erp-grid-empty" style={{ marginTop: 24 }}>
          이 화면은 관리자만 볼 수 있습니다.
        </p>
      </div>
    );
  }

  const [departments, employees] = await Promise.all([
    fetchAllRows<{ id: string; name: string; parent_department_id: string | null; sort_order: number }>((from, to) =>
      supabase.from("departments").select("id, name, parent_department_id, sort_order").order("sort_order").range(from, to),
    ),
    fetchAllRows<{ id: string; full_name: string | null; position_title: string | null; department_id: string | null }>(
      (from, to) => supabase.from("profiles").select("id, full_name, position_title, department_id").order("full_name").range(from, to),
    ),
  ]);

  const tree = buildOrgTree(
    departments.map((d) => ({ id: d.id, name: d.name, parentDepartmentId: d.parent_department_id, sortOrder: d.sort_order })),
    employees.map((e) => ({ id: e.id, fullName: e.full_name, positionTitle: e.position_title, departmentId: e.department_id })),
  );

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ F2: { href: "/settings/departments/new" }, Escape: { href: "/dashboard" } }} />
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-lg font-bold text-[var(--erp-text)]">환경설정 &gt; 조직도 관리</h1>
        <div className="erp-toolbar" style={{ marginBottom: 0 }}>
          <Link href="/settings/departments/new" className="erp-btn erp-btn-primary">
            F2 새 부서
          </Link>
          <Link href="/dashboard" className="erp-btn erp-btn-dark">
            ESC 닫기
          </Link>
        </div>
      </div>

      <PageGuide>
        부서 트리를 만들고 구성원을 배치합니다. 전자결재 결재선을 조직도
        기준으로 고를 때 이 구조가 그대로 쓰입니다.
      </PageGuide>

      <div className="erp-detail" style={{ marginTop: 0 }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">조직도</span>
        </div>
        <div className="erp-detail-body">
          {tree.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--erp-text-muted)" }}>
              등록된 부서가 없습니다.
            </p>
          ) : (
            tree.map((node) => <DepartmentNode key={node.id} node={node} depth={0} />)
          )}
        </div>
      </div>

      <div className="erp-detail">
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">구성원 배치</span>
        </div>
        <div className="erp-detail-body">
          <div className="erp-grid-wrap">
            <table className="erp-grid">
              <thead>
                <tr>
                  <th style={{ width: 140 }}>구성원</th>
                  <th>부서 · 직급/직책</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((e) => (
                  <tr key={e.id}>
                    <td>{e.full_name || "구성원"}</td>
                    <td>
                      <EmployeeDepartmentForm
                        action={setEmployeeDepartment}
                        userId={e.id}
                        departmentId={e.department_id}
                        positionTitle={e.position_title}
                        departments={departments}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
