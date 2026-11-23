import { formatKstDate } from "@/lib/kst-date";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ClickableRow } from "@/components/clickable-row";
import { CreateUserForm } from "@/components/create-user-form";
import { UserRoleSelect } from "@/components/user-role-select";
import { ExcelImportForm } from "@/components/excel-import-form";
import { ROLE_LABELS } from "@/lib/user-roles";
import { getCurrentActor } from "@/lib/current-actor";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { ListPageHeader } from "@/components/erp/page-header";
import { AccessWall } from "@/components/erp/access-wall";
import { PageGuide } from "@/components/erp/page-guide";
import { importEmployeesExcel } from "@/app/(dashboard)/settings/users/actions";
import { RowNoCell, RowNoHead } from "@/components/grid/row-no-cell";
import { ListSummaryBar } from "@/components/grid/list-summary-bar";
import { getTenantTheme } from "@/lib/tenant-theme";
import { getThemeFeatures } from "@/lib/erp-theme-config";

export default async function UsersSettingsPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const { role: roleParam } = await searchParams;
  const supabase = await createClient();
  const { userId, isAdmin } = await getCurrentActor(supabase);

  if (!isAdmin) {
    return <AccessWall title="환경설정 > 권한관리" message="이 화면은 관리자만 볼 수 있습니다." backHref="/dashboard" />;
  }

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, username, email, role, created_at")
    .order("created_at", { ascending: true });

  // 테마 기능(denseLists) — 역할 필터 칩과 인원 요약 줄. 꺼진 회사는 기존 화면 그대로(필터 파라미터도 무시).
  const features = getThemeFeatures(await getTenantTheme(supabase));
  const dense = features.denseLists;
  const allProfiles = profiles ?? [];
  const roleFilter = dense && roleParam && roleParam in ROLE_LABELS ? roleParam : null;
  const shown = roleFilter ? allProfiles.filter((p) => p.role === roleFilter) : allProfiles;
  const roleCount = (role: string) => allProfiles.filter((p) => p.role === role).length;
  const roleHref = (role: string | null) => (role ? `/settings/users?role=${role}` : "/settings/users");

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/dashboard" } }} />
      <ListPageHeader title="환경설정 > 권한관리" />
      <PageGuide>
        새 계정을 만들고 역할(권한)을 지정합니다. 아이디로 로그인하며,
        비밀번호는 최초 생성 시 값 그대로 유지되니 본인이 직접 로그인 후
        바꾸도록 안내해주세요.
      </PageGuide>

      <div className="erp-detail erp-u-mt-0 erp-u-mb-12">
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">새 계정 생성</span>
        </div>
        <div className="erp-detail-body">
          <CreateUserForm />
        </div>
      </div>

      <div className="erp-detail erp-u-mt-0 erp-u-mb-12">
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">엑셀 일괄등록</span>
        </div>
        <div className="erp-detail-body">
          <PageGuide className="mb-2">
            아이디/이름은 필수, 부서(조직도에 미리 등록돼 있어야 함)·직급·
            입사일(YYYY-MM-DD)·역할은 선택입니다. 비밀번호는 자동
            생성되며 결과 메시지에 한 번만 표시되니 그 자리에서 복사해
            전달해주세요. 이미 있는 아이디는 새로 만들지 않고 부서/직급/
            입사일/역할만 갱신합니다.
          </PageGuide>
          <ExcelImportForm action={importEmployeesExcel} templateHref="/templates/employees-template.xlsx" />
        </div>
      </div>

      {dense && (
        <>
          <div className="erp-date-presets erp-u-mb-8">
            <Link href={roleHref(null)} className={`erp-date-preset-btn${roleFilter ? "" : " active"}`}>
              전체<b className="erp-date-preset-count">{allProfiles.length}</b>
            </Link>
            {Object.entries(ROLE_LABELS).map(([role, label]) => (
                <Link key={role} href={roleHref(role)} className={`erp-date-preset-btn${roleFilter === role ? " active" : ""}`}>
                  {label}
                  <b className="erp-date-preset-count">{roleCount(role)}</b>
                </Link>
              ))}
          </div>
          <ListSummaryBar
            items={[
              { label: "계정", value: `${allProfiles.length}개` },
              ...Object.entries(ROLE_LABELS).map(([role, label]) => ({ label, value: `${roleCount(role)}` })),
            ]}
          />
        </>
      )}

      <div className="erp-grid-wrap has-card-view">
        <table className="erp-grid">
          <thead>
            <tr>
              <RowNoHead />
              <th>아이디</th>
              <th>이름</th>
              <th>이메일</th>
              <th className="erp-col-xl">역할</th>
              <th className="erp-col-l">가입일</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((row, i) => (
              <ClickableRow key={row.id} href={`/settings/users/${row.id}`}>
                <RowNoCell n={i + 1} />
                <td>{row.username ?? "-"}</td>
                <td>{row.full_name ?? "-"}</td>
                <td className="erp-u-muted">
                  {row.email ?? "-"}
                </td>
                <td>
                  <UserRoleSelect
                    userId={row.id}
                    role={row.role}
                    disabled={row.id === userId}
                  />
                </td>
                <td>{formatKstDate(row.created_at)}</td>
              </ClickableRow>
            ))}
            {!shown.length && (
              <tr>
                <td colSpan={5 + (features.rowNumbers ? 1 : 0)} className="erp-grid-empty">
                  {roleFilter ? "이 역할의 계정이 없습니다." : "등록된 계정이 없습니다."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="erp-row-card-list">
        {shown.map((row) => (
          <Link key={row.id} href={`/settings/users/${row.id}`} className="erp-row-card">
            <div className="erp-row-card-head">
              <span className="erp-row-card-partner">{row.full_name ?? "-"}</span>
              <span className="erp-row-card-date">{formatKstDate(row.created_at)}</span>
            </div>
            <dl className="erp-order-item-fields">
              <div>
                <dt>아이디</dt>
                <dd>{row.username ?? "-"}</dd>
              </div>
              <div>
                <dt>이메일</dt>
                <dd>{row.email ?? "-"}</dd>
              </div>
            </dl>
            <div>
              <UserRoleSelect userId={row.id} role={row.role} disabled={row.id === userId} />
            </div>
          </Link>
        ))}
        {!shown.length && <p className="erp-grid-empty">{roleFilter ? "이 역할의 계정이 없습니다." : "등록된 계정이 없습니다."}</p>}
      </div>
      <PageGuide className="mt-2">
        {Object.entries(ROLE_LABELS)
          .map(([, label]) => label)
          .join(" · ")}{" "}
        중 하나로 지정할 수 있습니다. 본인 계정의 역할은 변경할 수 없습니다.
        행을 클릭하면 아이디/이름/비밀번호 수정 및 계정 삭제가 가능합니다.
      </PageGuide>
    </div>
  );
}
