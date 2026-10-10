import { createClient } from "@/lib/supabase/server";
import { getCurrentActor } from "@/lib/current-actor";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { PageGuide } from "@/components/erp/page-guide";
import { AccessWall } from "@/components/erp/access-wall";
import { FeatureToggle } from "@/components/feature-toggle";
import { toggleDepartmentPageAccess } from "@/app/(dashboard)/settings/page-access/actions";
import { RESTRICTABLE_PAGES } from "@/lib/department-page-access";
import { fetchAllRows } from "@/lib/fetch-all-rows";

export default async function PageAccessSettingsPage() {
  const supabase = await createClient();
  const { isAdmin } = await getCurrentActor(supabase);

  if (!isAdmin) {
    return <AccessWall title="환경설정 > 화면별 부서 접근 권한" message="이 화면은 관리자만 볼 수 있습니다." backHref="/dashboard" />;
  }

  const [departments, accessRows] = await Promise.all([
    fetchAllRows<{ id: string; name: string }>((from, to) =>
      supabase.from("departments").select("id, name").order("sort_order", { ascending: true }).range(from, to),
    ),
    supabase.from("department_page_access").select("page_key, department_id").then((r) => r.data ?? []),
  ]);

  const allowedDeptIds = new Map<string, Set<string>>();
  for (const row of accessRows ?? []) {
    if (!allowedDeptIds.has(row.page_key)) allowedDeptIds.set(row.page_key, new Set());
    allowedDeptIds.get(row.page_key)!.add(row.department_id);
  }

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/dashboard" } }} />
      <h1 className="mb-1 text-lg font-bold text-[var(--erp-text)]">환경설정 &gt; 화면별 부서 접근 권한</h1>

      <PageGuide>
        미수금현황처럼 민감한 화면을 특정 부서만 볼 수 있게 제한합니다. 화면 하나에 체크된 부서가 하나도
        없으면(기본값) 그 화면은 지금처럼 전체 공개입니다 — 특정 부서만 보이게 하려면 그 부서를
        체크하세요. 관리자는 이 설정과 무관하게 항상 모든 화면을 볼 수 있습니다.
      </PageGuide>

      {!departments?.length ? (
        <p className="erp-grid-empty" style={{ marginTop: 24 }}>
          먼저 환경설정 &gt; 조직도 관리에서 부서를 등록하세요.
        </p>
      ) : (
        <div className="erp-grid-wrap">
          <table className="erp-grid">
            <thead>
              <tr>
                <th style={{ width: 220 }}>화면</th>
                {departments.map((d) => (
                  <th key={d.id}>{d.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {RESTRICTABLE_PAGES.map((page) => {
                const allowed = allowedDeptIds.get(page.pageKey);
                return (
                  <tr key={page.pageKey}>
                    <td>{page.label}</td>
                    {departments.map((d) => (
                      <td key={d.id}>
                        <FeatureToggle
                          featureKey={`${page.pageKey}::${d.id}`}
                          label={`${page.label} - ${d.name}`}
                          enabled={allowed?.has(d.id) ?? false}
                          action={toggleDepartmentPageAccess}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
